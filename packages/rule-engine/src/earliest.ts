import type { LogEvent, Platform } from '@pfa/core';
import { runSignatures, type SignatureMatch } from './classify.js';
import { isCascade } from './dedup.js';

/**
 * Find the earliest *meaningful* failure. Chronology matters: the first real
 * error usually causes everything after it. We prefer, in order:
 *   1. the earliest event that matches a high-weight signature,
 *   2. otherwise the earliest non-cascade error,
 *   3. otherwise the earliest error of any kind.
 */
export interface EarliestFailure {
  event: LogEvent;
  match?: SignatureMatch;
  reason: 'signature' | 'first_non_cascade_error' | 'first_error';
}

export function earliestMeaningfulFailure(
  events: LogEvent[],
  platform?: Platform,
): EarliestFailure | undefined {
  const errors = events
    .filter((e) => e.severity === 'error' || e.severity === 'fatal')
    .sort((a, b) => a.seq - b.seq);
  if (errors.length === 0) return undefined;

  const matches = runSignatures(errors, platform)
    .filter((m) => m.signature.weight >= 0.7)
    .sort((a, b) => a.event.seq - b.event.seq);
  if (matches[0]) {
    return { event: matches[0].event, match: matches[0], reason: 'signature' };
  }

  const firstNonCascade = errors.find((e) => !isCascade(e.message));
  if (firstNonCascade) {
    return { event: firstNonCascade, reason: 'first_non_cascade_error' };
  }

  return { event: errors[0]!, reason: 'first_error' };
}
