import { describe, it, expect } from 'vitest';
import type { ChangeEvent, ExternalIssue, RunDetail } from '@pfa/core';
import { runInvestigation } from './pipeline.js';

function failedRun(): RunDetail {
  return {
    id: 'run-1',
    platform: 'local',
    pipeline: 'Customer Revenue Pipeline',
    failedStage: 'silver_transformation',
    status: 'failed',
    sourceRef: { platform: 'local', nativeId: 'run-1' },
    logs: [
      { seq: 0, severity: 'info', message: 'Starting silver_transformation', redacted: false },
      { seq: 1, severity: 'info', message: 'connecting with password=hunter2', redacted: false },
      {
        seq: 2,
        severity: 'error',
        message: "KeyError: 'customer_region'",
        source: 'silver_transformation',
        redacted: false,
      },
      { seq: 3, severity: 'error', message: 'Job run failed', redacted: false },
      { seq: 4, severity: 'error', message: 'Job run failed', redacted: false },
    ],
  };
}

describe('runInvestigation', () => {
  it('produces a ranked, redacted, deduped investigation', () => {
    const inv = runInvestigation({ run: failedRun(), redaction: 'strict' });

    expect(inv.status).toBe('completed');
    expect(inv.incident.category).toBe('schema.missing_column');
    // Redaction happened.
    expect(inv.meaningfulErrors.every((e) => !e.message.includes('hunter2'))).toBe(true);
    // Cascades removed — only the KeyError remains.
    expect(inv.meaningfulErrors).toHaveLength(1);
    expect(inv.incident.hypotheses[0]!.title).toContain('customer_region');
    // No baseline => a missing-information evidence item exists.
    const kinds = inv.incident.hypotheses[0]!.evidence.map((e) => e.kind);
    expect(kinds).toContain('missing_information');
  });

  it('upgrades confidence when a change event corroborates the failing token', () => {
    const changes: ChangeEvent[] = [
      {
        id: 'pr-248',
        platform: 'github',
        kind: 'pull_request',
        title: 'Rename customer_region to region_code',
        summary: 'Renamed column customer_region to region_code in the customers model.',
        sourceRef: { platform: 'github', nativeId: '248', url: 'https://example/pr/248' },
      },
    ];
    const related: ExternalIssue[] = [
      { id: 'DATA-184', platform: 'jira', key: 'DATA-184', title: 'Silver transform column rename', similarity: 0.82 },
    ];
    const inv = runInvestigation({ run: failedRun(), changes, relatedIssues: related });
    const top = inv.incident.hypotheses[0]!;
    expect(top.confidence).toBe('high');
    expect(top.evidence.some((e) => e.kind === 'strong_correlation')).toBe(true);
    expect(inv.incident.relatedIssues[0]!.key).toBe('DATA-184');
  });
});
