import type { LogEvent } from '@pfa/core';

/**
 * Collapse duplicated and cascading errors so the engine reasons about the few
 * lines that matter, not thousands of echoes.
 *
 *  - Normalize each message into a template (strip timestamps, ids, numbers,
 *    hex, memory addresses, paths) and keep only the first event per template.
 *  - Drop generic "cascade" lines (a job/task reporting that something below it
 *    failed) — these are effects, not causes.
 */

const CASCADE_PHRASES: RegExp[] = [
  /^traceback \(most recent call last\)/i,
  /^\s*at .*\(.*:\d+:\d+\)\s*$/i, // JS stack frames
  /job (?:run )?failed/i,
  /task .* (?:failed|exited)/i,
  /stage .* failed/i,
  /process (?:completed|exited) with (?:exit )?code [1-9]/i,
  /pipeline (?:run )?failed/i,
  /command failed with exit code/i,
  /notebook exited with/i,
  /workflow run failed/i,
  /one or more (?:tasks|steps) failed/i,
];

export function normalizeTemplate(message: string): string {
  return message
    .replace(/\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '<TS>')
    .replace(/0x[0-9a-fA-F]+/g, '<HEX>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>')
    .replace(/\b\d+\b/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isCascade(message: string): boolean {
  return CASCADE_PHRASES.some((re) => re.test(message.trim()));
}

export interface DedupResult {
  events: LogEvent[];
  removedDuplicates: number;
  removedCascades: number;
}

/**
 * Returns errors/fatals only, deduplicated. Cascade lines are removed *unless*
 * they are the only thing present (so we never end up with nothing).
 */
export function dedupErrors(events: LogEvent[]): DedupResult {
  const errors = events.filter((e) => e.severity === 'error' || e.severity === 'fatal');
  const seen = new Set<string>();
  const kept: LogEvent[] = [];
  let removedDuplicates = 0;
  let removedCascades = 0;

  for (const ev of errors) {
    const tpl = normalizeTemplate(ev.message);
    if (seen.has(tpl)) {
      removedDuplicates++;
      continue;
    }
    seen.add(tpl);
    if (isCascade(ev.message)) {
      removedCascades++;
      continue;
    }
    kept.push(ev);
  }

  if (kept.length === 0 && errors.length > 0) {
    // Everything was cascade — fall back to the first unique error.
    const firstSeen = new Set<string>();
    for (const ev of errors) {
      const tpl = normalizeTemplate(ev.message);
      if (!firstSeen.has(tpl)) {
        firstSeen.add(tpl);
        kept.push(ev);
      }
    }
    removedCascades = 0;
  }

  return { events: kept, removedDuplicates, removedCascades };
}
