import {
  shortId,
  type ChangeEvent,
  type ExternalIssue,
  type Incident,
  type Investigation,
  type RunDetail,
  type RunDiff,
  type SourceRef,
} from '@pfa/core';
import { classify, dedupErrors, diffRuns, earliestMeaningfulFailure } from '@pfa/rule-engine';
import { redactLogEvents, type RedactionLevel } from '@pfa/security';
import { buildHypotheses } from './hypotheses.js';

export interface InvestigationInput {
  /** The failed run, already normalized by a connector. */
  run: RunDetail;
  /** A previous successful run for comparison, if available. */
  baseline?: RunDetail;
  /** Change events (commits, PRs, schema changes) from connected systems. */
  changes?: ChangeEvent[];
  /** Related historical issues (e.g. from Jira). */
  relatedIssues?: ExternalIssue[];
  redaction?: RedactionLevel;
}

/**
 * The investigation workflow. A pure function over the normalized model, so the
 * CLI, the VS Code extension and the tests all run *exactly* this pipeline.
 *
 * Steps (mirrors the documented 19-step workflow):
 *   collect → redact → segment → dedup cascades → earliest failure → locate →
 *   classify → compare runs → correlate changes → search incidents →
 *   rank hypotheses (transparent confidence) → recommend → report.
 */
export function runInvestigation(input: InvestigationInput): Investigation {
  const notes: string[] = [];
  const redaction = input.redaction ?? 'strict';

  // 3. Redact secrets/PII at the boundary.
  const { events: redacted, hitCount } = redactLogEvents(input.run.logs, redaction);
  if (hitCount > 0) notes.push(`Redacted ${hitCount} sensitive value(s) before analysis.`);

  // 4–5. Segment + collapse duplicates/cascades.
  const { events: meaningful, removedDuplicates, removedCascades } = dedupErrors(redacted);
  if (removedDuplicates + removedCascades > 0) {
    notes.push(
      `Collapsed ${removedDuplicates} duplicate and ${removedCascades} cascading error line(s).`,
    );
  }

  // 6–7. Earliest meaningful failure + locate.
  const earliest = earliestMeaningfulFailure(meaningful, input.run.platform);

  // 8. Classify.
  const classification = classify(meaningful, input.run.platform);

  // 10. Compare against baseline.
  let diff: RunDiff | undefined;
  if (input.baseline) {
    diff = diffRuns(input.run, input.baseline);
  } else {
    notes.push('No baseline run provided; add one with --baseline for stronger correlation.');
  }

  // 11–15. Correlate + rank hypotheses.
  const changes = input.changes ?? [];
  const relatedIssues = input.relatedIssues ?? [];
  const hypotheses = buildHypotheses({ classification, earliest, diff, changes, relatedIssues });

  const top = hypotheses[0];
  const target: SourceRef = input.run.sourceRef;

  const incident: Incident = {
    id: shortId('inc' + input.run.id),
    title: `${input.run.pipeline}: ${top?.title ?? 'Unclassified failure'}`,
    primaryPlatform: input.run.platform,
    pipeline: input.run.pipeline,
    failedStage: input.run.failedStage ?? earliest?.event.source,
    category: top?.category ?? 'unknown',
    confidence: top?.confidence ?? 'low',
    summary: buildSummary(input.run.pipeline, top?.title, earliest?.event.message),
    createdAt: new Date().toISOString(),
    hypotheses,
    relatedIssues,
  };

  return {
    id: shortId('investigation' + input.run.id + Date.now()),
    createdAt: new Date().toISOString(),
    target,
    status: hypotheses.length > 0 && meaningful.length > 0 ? 'completed' : 'insufficient_evidence',
    incident,
    meaningfulErrors: meaningful,
    diff,
    changes,
    notes,
  };
}

function buildSummary(pipeline: string, title?: string, firstError?: string): string {
  if (!title) return `No meaningful failure could be isolated for ${pipeline}.`;
  const cause = firstError ? ` The earliest meaningful error was: ${firstError}` : '';
  return `${pipeline} failed with probable cause: ${title}.${cause}`;
}
