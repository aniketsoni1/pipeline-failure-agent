import { describe, it, expect } from 'vitest';
import type { LogEvent } from '@pfa/core';
import { classify } from './classify.js';
import { dedupErrors, normalizeTemplate, isCascade } from './dedup.js';
import { earliestMeaningfulFailure } from './earliest.js';

function ev(seq: number, severity: LogEvent['severity'], message: string): LogEvent {
  return { seq, severity, message, redacted: false };
}

describe('dedup', () => {
  it('normalizes volatile tokens into a stable template', () => {
    const a = normalizeTemplate('2024-01-01T10:00:00Z task 123 failed at 0xAB');
    const b = normalizeTemplate('2024-06-02T11:22:33Z task 999 failed at 0xFF');
    expect(a).toBe(b);
  });

  it('recognizes cascade lines', () => {
    expect(isCascade('Job run failed')).toBe(true);
    expect(isCascade("KeyError: 'customer_region'")).toBe(false);
  });

  it('removes duplicates and cascades but never empties the set', () => {
    const events = [
      ev(0, 'error', 'Traceback (most recent call last)'),
      ev(1, 'error', "KeyError: 'customer_region'"),
      ev(2, 'error', "KeyError: 'customer_region'"),
      ev(3, 'error', 'Job run failed'),
    ];
    const res = dedupErrors(events);
    expect(res.events).toHaveLength(1);
    expect(res.events[0]!.message).toContain('customer_region');
    expect(res.removedDuplicates).toBe(1);
    expect(res.removedCascades).toBe(2);
  });
});

describe('earliest meaningful failure', () => {
  it('prefers the earliest high-weight signature over later noise', () => {
    const events = [
      ev(0, 'info', 'starting'),
      ev(1, 'error', "KeyError: 'region_code'"),
      ev(2, 'error', 'Job run failed'),
    ];
    const e = earliestMeaningfulFailure(events);
    expect(e?.reason).toBe('signature');
    expect(e?.event.seq).toBe(1);
    expect(e?.match?.token).toBe('region_code');
  });

  it('skips leading cascade lines', () => {
    const events = [
      ev(0, 'error', 'Traceback (most recent call last)'),
      ev(1, 'error', 'ValueError: something odd'),
    ];
    const e = earliestMeaningfulFailure(events);
    expect(e?.event.seq).toBe(1);
  });
});

describe('classify', () => {
  it('classifies a missing column failure', () => {
    const events = [ev(0, 'error', "KeyError: 'customer_region'")];
    const c = classify(events);
    expect(c.primary).toBe('schema.missing_column');
    expect(c.confidenceScore).toBeGreaterThan(0.4);
  });

  it('classifies a missing GitHub secret', () => {
    const events = [ev(0, 'error', 'Error: Input required and not supplied: SNOWFLAKE_PASSWORD')];
    const c = classify(events, 'github-actions');
    expect(c.primary).toBe('auth.secret_missing_or_expired');
  });

  it('returns unknown for unrecognized errors', () => {
    const c = classify([ev(0, 'error', 'zzz something totally novel qqq')]);
    expect(c.primary).toBe('unknown');
  });
});
