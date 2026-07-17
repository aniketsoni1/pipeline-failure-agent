import { promises as fs } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  appError,
  err,
  ok,
  type Capability,
  type Connection,
  type Connector,
  type ConnectorContext,
  type Platform,
  type Result,
  type RunDetail,
  type ToolDescriptor,
  type ConfigSnapshot,
} from '@pfa/core';
import { z } from 'zod';
import { parseLogText } from './parse.js';

export { parseLogText } from './parse.js';

const metaSchema = z
  .object({
    platform: z.string().optional(),
    pipeline: z.string().optional(),
    failedStage: z.string().optional(),
    parameters: z.record(z.string()).optional(),
    dependencies: z.record(z.string()).optional(),
    environment: z.record(z.string()).optional(),
    baseline: z.string().optional(),
  })
  .partial();

export type LocalMeta = z.infer<typeof metaSchema>;

function toConfigs(meta: LocalMeta): ConfigSnapshot[] {
  const configs: ConfigSnapshot[] = [];
  if (meta.dependencies) {
    configs.push({ id: 'deps', kind: 'dependencies', values: meta.dependencies });
  }
  if (meta.environment) {
    configs.push({ id: 'env', kind: 'environment', values: meta.environment });
  }
  return configs;
}

/** Build a RunDetail directly from log text (used by tests and stdin). */
export function runFromLogText(text: string, meta: LocalMeta = {}, id = 'local-run'): RunDetail {
  const logs = parseLogText(text, meta.failedStage);
  const platform = (meta.platform as Platform) ?? 'local';
  return {
    id,
    platform,
    pipeline: meta.pipeline ?? 'Local pipeline',
    failedStage: meta.failedStage,
    status: 'failed',
    parameters: meta.parameters,
    sourceRef: { platform, nativeId: id, locator: { file: id } },
    logs,
    configs: toConfigs(meta),
  };
}

/**
 * Read a log file into a RunDetail. If a sibling `<name>.meta.json` exists it is
 * merged (platform, pipeline, dependencies, baseline path…). Returns the failed
 * run and, when declared, a baseline run for comparison.
 */
export async function ingestLogFile(
  path: string,
): Promise<{ run: RunDetail; baseline?: RunDetail }> {
  const text = await fs.readFile(path, 'utf8');
  const dir = dirname(path);
  const base = basename(path).replace(/\.[^.]+$/, '');
  let meta: LocalMeta = {};
  for (const candidate of [join(dir, `${base}.meta.json`), join(dir, 'meta.json')]) {
    try {
      meta = metaSchema.parse(JSON.parse(await fs.readFile(candidate, 'utf8')));
      break;
    } catch {
      /* no meta */
    }
  }
  const run = runFromLogText(text, meta, path);
  let baseline: RunDetail | undefined;
  if (meta.baseline) {
    try {
      const baseText = await fs.readFile(join(dir, meta.baseline), 'utf8');
      baseline = runFromLogText(baseText, { ...meta, baseline: undefined }, meta.baseline);
      baseline.status = 'success';
    } catch {
      /* baseline optional */
    }
  }
  return { run, baseline };
}

/** Connector wrapper so local logs flow through the same interface as remotes. */
export class LocalConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'local';
  readonly capabilities = new Set<Capability>(['runs.get', 'logs.get']);
  constructor(id = 'local') {
    this.id = id;
  }
  describe(): Connection {
    return {
      id: this.id,
      platform: 'local',
      label: 'Local logs',
      credentialProvider: 'none',
      mode: 'read-only',
    };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async getRun(
    _ctx: ConnectorContext,
    id: string,
  ): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    try {
      const { run } = await ingestLogFile(id);
      return ok(run);
    } catch (e) {
      return err(appError('NOT_FOUND', `Could not read log file: ${(e as Error).message}`, { id }));
    }
  }
  tools(): ToolDescriptor[] {
    return [
      {
        name: 'local.read_log',
        description: 'Read and parse a local log file into normalized log events.',
        input: z.object({ path: z.string() }),
        output: z.object({ events: z.number() }),
        access: 'read',
        risk: 'low',
        permissions: ['fs:read'],
        redaction: 'strict',
        timeoutMs: 5000,
        retries: 0,
        audit: true,
      },
    ];
  }
}
