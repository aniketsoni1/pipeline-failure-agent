import { Command } from 'commander';
import pc from 'picocolors';
import { promises as fs } from 'node:fs';
import type { Confidence } from '@pfa/core';
import {
  DEFAULT_CONFIG_PATH,
  defaultConfig,
  loadConfig,
  runDoctor,
  saveConfig,
} from '@pfa/configuration';
import { getConnector, listPlatforms, JiraConnector } from '@pfa/connectors';
import { ingestLogFile } from '@pfa/connector-local';
import { toMarkdown } from '@pfa/reporting';
import type { OutputFormat } from '@pfa/reporting';
import { createCliContext } from './context.js';
import { investigatePlatformRun, investigateRun } from '@pfa/agent';
import { emit, renderInvestigation, shouldFail } from './output.js';

const program = new Command();

program
  .name('pipeline-agent')
  .description('Deterministic-first troubleshooting agent for failed data pipelines, jobs and queries.')
  .version('0.1.0');

// ---------------------------------------------------------------- general ---
program
  .command('init')
  .description('Create a default configuration file.')
  .option('--force', 'overwrite an existing config')
  .action(async (opts) => {
    try {
      await fs.access(DEFAULT_CONFIG_PATH);
      if (!opts.force) {
        console.log(pc.yellow(`Config already exists at ${DEFAULT_CONFIG_PATH} (use --force).`));
        return;
      }
    } catch {
      /* not present */
    }
    await saveConfig(defaultConfig());
    console.log(pc.green(`Initialized ${DEFAULT_CONFIG_PATH}`));
    console.log(pc.dim('Add connections and (optionally) enable AI with `pipeline-agent configure`.'));
  });

program
  .command('doctor')
  .description('Diagnose the local environment and configuration.')
  .action(async () => {
    const config = await loadConfig();
    const checks = await runDoctor(config);
    for (const c of checks) {
      const mark = c.ok ? pc.green('✓') : pc.red('✗');
      console.log(`  ${mark} ${pc.bold(c.name.padEnd(12))} ${pc.dim(c.detail)}`);
    }
  });

program
  .command('configure')
  .description('Show or update non-secret configuration.')
  .option('--show', 'print the current configuration')
  .option('--redaction <level>', 'set redaction level (strict|standard|none)')
  .option('--enable-ai <provider>', 'enable AI with the named provider')
  .option('--disable-ai', 'disable remote AI (local-only)')
  .action(async (opts) => {
    const config = await loadConfig();
    if (opts.redaction) config.security.redaction = opts.redaction;
    if (opts.enableAi) {
      config.ai.enabled = true;
      config.ai.provider = opts.enableAi;
    }
    if (opts.disableAi) config.ai.enabled = false;
    if (opts.redaction || opts.enableAi || opts.disableAi) {
      await saveConfig(config);
      console.log(pc.green('Configuration updated.'));
    }
    if (opts.show || (!opts.redaction && !opts.enableAi && !opts.disableAi)) {
      console.log(JSON.stringify(config, null, 2));
    }
  });

const connections = program.command('connections').description('Manage platform connections.');
connections
  .command('list')
  .description('List configured connections and available platforms.')
  .action(async () => {
    const config = await loadConfig();
    console.log(pc.bold('Configured connections:'));
    if (config.connections.length === 0) console.log(pc.dim('  (none)'));
    for (const c of config.connections) {
      console.log(`  - ${c.id} ${pc.dim(`(${c.platform}, ${c.mode}, creds:${c.credentialProvider})`)}`);
    }
    console.log(pc.bold('\nAvailable platforms:'));
    console.log('  ' + listPlatforms().join(', '));
  });

program
  .command('plugins')
  .description('List installed connector plugins.')
  .command('list')
  .action(() => {
    for (const p of listPlatforms()) {
      const c = getConnector(p);
      if (c) console.log(`  - ${pc.bold(p)} ${pc.dim([...c.capabilities].join(', '))}`);
    }
  });

program
  .command('status')
  .description('Show a one-line status summary.')
  .action(async () => {
    const config = await loadConfig();
    console.log(
      `pipeline-agent · ${config.connections.length} connection(s) · redaction=${config.security.redaction} · ai=${config.ai.enabled ? config.ai.provider : 'off'}`,
    );
  });

// ------------------------------------------------------------- investigate ---
program
  .command('investigate [logfile]')
  .description('Investigate a failed pipeline from a log file or a platform run.')
  .option('--platform <platform>', 'platform connector to use')
  .option('--run-id <id>', 'run/query/operation id to investigate')
  .option('--baseline <id>', 'a previous successful run id for comparison')
  .option('-f, --format <format>', 'terminal|json|yaml|markdown|sarif|html', 'terminal')
  .option('-o, --output <file>', 'write the report to a file')
  .option('--fail-on <level>', 'exit non-zero if confidence >= low|medium|high')
  .option('--no-redact', 'disable secret/PII redaction (not recommended)')
  .option('--no-correlate', 'skip cross-platform change/incident correlation')
  .option('--non-interactive', 'never prompt; auto-deny write operations')
  .action(async (logfile, opts) => {
    const { ctx } = createCliContext({ nonInteractive: opts.nonInteractive, quiet: opts.format !== 'terminal' });
    const redaction = opts.redact === false ? 'none' : 'strict';
    try {
      const inv = logfile
        ? await (async () => {
            const { run, baseline } = await ingestLogFile(logfile);
            return investigateRun(ctx, run, { baseline, redaction, correlate: opts.correlate });
          })()
        : await investigatePlatformRun(ctx, requirePlatform(opts), requireRunId(opts), {
            baselineId: opts.baseline,
            redaction,
            correlate: opts.correlate,
          });

      const content = renderInvestigation(inv, opts.format as OutputFormat);
      await emit(content, opts.output);

      if (shouldFail(inv, opts.failOn as Confidence | undefined)) {
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(pc.red(`Investigation failed: ${(e as Error).message}`));
      process.exitCode = 2;
    }
  });

// ------------------------------------------------------------- platform cmds ---
function platformInspect(cmd: string, platform: string, idLabel: string) {
  program
    .command(`${cmd} [id]`)
    .description(`Inspect and investigate a ${platform} ${idLabel}.`)
    .option('-f, --format <format>', 'terminal|json|markdown', 'terminal')
    .option('-o, --output <file>', 'write the report to a file')
    .action(async (id, opts) => {
      if (!id) {
        console.error(pc.red(`Provide a ${idLabel}.`));
        process.exitCode = 2;
        return;
      }
      const { ctx } = createCliContext({ nonInteractive: true, quiet: opts.format !== 'terminal' });
      try {
        const inv = await investigatePlatformRun(ctx, platform, id, {});
        await emit(renderInvestigation(inv, opts.format as OutputFormat), opts.output);
      } catch (e) {
        console.error(pc.red((e as Error).message));
        process.exitCode = 2;
      }
    });
}
platformInspect('github:inspect', 'github-actions', 'run id');
platformInspect('databricks:inspect', 'databricks', 'run id');
platformInspect('snowflake:inspect', 'snowflake', 'query id');
platformInspect('mongodb:inspect', 'mongodb', 'operation id');

// github runs list
const github = program.command('github').description('GitHub Actions commands.');
github
  .command('runs')
  .command('list')
  .description('List recent workflow runs.')
  .action(async () => {
    const { ctx } = createCliContext({ nonInteractive: true, quiet: true });
    const c = getConnector('github-actions')!;
    const res = await c.listRuns!(ctx, { status: 'all' });
    if (res.ok) {
      for (const r of res.value) {
        const mark = r.status === 'failed' ? pc.red('failed') : pc.green(r.status);
        console.log(`  ${r.sourceRef.nativeId}  ${mark}  ${r.pipeline}  ${pc.dim(r.startedAt ?? '')}`);
      }
    }
  });

// jira
const jira = program.command('jira').description('Jira incident commands.');
jira
  .command('issues')
  .command('search [jql]')
  .description('Search issues (fixture-backed).')
  .action(async (jql: string) => {
    const { ctx } = createCliContext({ nonInteractive: true, quiet: true });
    const res = await new JiraConnector().searchIssues(ctx, jql ?? '');
    if (res.ok) for (const i of res.value) console.log(`  ${i.key}  ${pc.dim(i.status ?? '')}  ${i.title}`);
  });
jira
  .command('similar-incidents')
  .description('Find historical incidents similar to a description.')
  .requiredOption('--about <text>', 'text describing the failure')
  .action(async (opts) => {
    const { ctx } = createCliContext({ nonInteractive: true, quiet: true });
    const rows = await new JiraConnector().findSimilar(ctx, opts.about);
    for (const i of rows) console.log(`  ${i.key}  ${((i.similarity ?? 0) * 100) | 0}%  ${i.title}`);
  });
jira
  .command('issue')
  .command('create-from-report <report.md>')
  .description('Create a Jira issue from a report (requires approval).')
  .option('--yes', 'pre-approve the write operation')
  .action(async (reportPath: string, opts) => {
    const { ctx } = createCliContext({ yes: opts.yes });
    const body = await fs.readFile(reportPath, 'utf8');
    const title = body.split('\n')[0]?.replace(/^#\s*/, '') ?? 'Pipeline incident';
    const res = await new JiraConnector().createFromReport(ctx, title, body);
    if (res.ok) console.log(pc.green(`Created ${res.value.key}: ${res.value.url}`));
    else console.log(pc.yellow(res.error.message));
  });

// convenience: write a markdown report from a log file
program
  .command('report <logfile>')
  .description('Generate a Markdown incident report from a log file.')
  .option('-o, --output <file>', 'output path', 'incident.md')
  .action(async (logfile: string, opts) => {
    const { ctx } = createCliContext({ nonInteractive: true, quiet: true });
    const { run, baseline } = await ingestLogFile(logfile);
    const inv = await investigateRun(ctx, run, { baseline });
    await emit(toMarkdown(inv), opts.output);
  });

function requirePlatform(opts: { platform?: string }): string {
  if (!opts.platform) throw new Error('Provide --platform (or a log file path).');
  return opts.platform;
}
function requireRunId(opts: { runId?: string }): string {
  if (!opts.runId) throw new Error('Provide --run-id.');
  return opts.runId;
}

program.parseAsync(process.argv);
