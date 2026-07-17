import { describe, it, expect } from 'vitest';
import { createContext } from '@pfa/connectors';
import { investigatePlatformRun } from './index.js';

/**
 * End-to-end / integration test of the flagship cross-platform scenario:
 * a Databricks task fails resolving `customer_region`; the agent correlates a
 * Snowflake schema change and a similar historical Jira incident (DATA-184).
 */
describe('cross-platform investigation (e2e)', () => {
  it('correlates a Databricks failure with a Snowflake change and a Jira incident', async () => {
    const ctx = createContext();
    const inv = await investigatePlatformRun(ctx, 'databricks', '551', { baselineId: '540' });

    expect(inv.status).toBe('completed');
    expect(inv.incident.category).toBe('schema.missing_column');
    expect(inv.incident.confidence).toBe('high');

    const top = inv.incident.hypotheses[0]!;
    // Confirmed earliest error.
    expect(top.evidence.some((e) => e.kind === 'confirmed')).toBe(true);
    // Strong correlation to the Snowflake ALTER TABLE change event.
    expect(
      top.evidence.some(
        (e) => e.kind === 'strong_correlation' && /region/i.test(e.statement),
      ),
    ).toBe(true);
    // Historical incident surfaced.
    expect(inv.incident.relatedIssues.some((i) => i.key === 'DATA-184')).toBe(true);
  });

  it('runs read-only with no writes attempted (default-deny context)', async () => {
    const ctx = createContext();
    const inv = await investigatePlatformRun(ctx, 'snowflake', '01af-fail');
    expect(inv.incident.category).toBe('schema.missing_column');
  });

  it('throws a clear error for an unknown run id', async () => {
    await expect(investigatePlatformRun(createContext(), 'databricks', 'does-not-exist')).rejects.toThrow();
  });
});
