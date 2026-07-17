import type { ConnectorContext, Investigation, Platform, RunDetail } from '@pfa/core';
import { CONNECTOR_FACTORIES, JiraConnector, getConnector } from '@pfa/connectors';
import { runInvestigation } from '@pfa/investigation-engine';
import type { RedactionLevel } from '@pfa/security';

/**
 * The shared investigation flow used by BOTH the CLI and the VS Code extension.
 * Given a normalized failed run, it gathers cross-platform evidence and runs the
 * deterministic engine. Neither UI reimplements any of this — this is the single
 * orchestration seam above the pure engine.
 */
export interface EvidenceOptions {
  baseline?: RunDetail;
  redaction?: RedactionLevel;
  /** Correlate changes/incidents across all configured connectors (default true). */
  correlate?: boolean;
}

export async function investigateRun(
  ctx: ConnectorContext,
  run: RunDetail,
  opts: EvidenceOptions = {},
): Promise<Investigation> {
  const correlate = opts.correlate ?? true;
  const changes = [];
  const relatedIssues = [];

  if (correlate) {
    for (const factory of Object.values(CONNECTOR_FACTORIES)) {
      const c = factory!();
      if (c.capabilities.has('changes.search') && c.searchChanges) {
        const res = await c.searchChanges(ctx, {});
        if (res.ok) changes.push(...res.value);
      }
    }
    const jira = new JiraConnector();
    const errorText = run.logs
      .filter((l) => l.severity === 'error' || l.severity === 'fatal')
      .map((l) => l.message)
      .join(' ');
    const seed = `${run.pipeline} ${run.failedStage ?? ''} ${errorText}`;
    relatedIssues.push(...(await jira.findSimilar(ctx, seed)));
  }

  return runInvestigation({
    run,
    baseline: opts.baseline,
    changes,
    relatedIssues,
    redaction: opts.redaction,
  });
}

export async function investigatePlatformRun(
  ctx: ConnectorContext,
  platform: string,
  runId: string,
  opts: EvidenceOptions & { baselineId?: string } = {},
): Promise<Investigation> {
  const connector = getConnector(platform as Platform);
  if (!connector || !connector.getRun) {
    throw new Error(`No connector with run retrieval for platform "${platform}".`);
  }
  const res = await connector.getRun(ctx, runId);
  if (!res.ok) throw new Error(res.error.message);

  let baseline: RunDetail | undefined = opts.baseline;
  if (!baseline && opts.baselineId && connector.getRun) {
    const b = await connector.getRun(ctx, opts.baselineId);
    if (b.ok) baseline = b.value;
  }
  return investigateRun(ctx, res.value, { ...opts, baseline });
}
