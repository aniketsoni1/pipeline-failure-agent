import { describe, it, expect } from 'vitest';
import { CONNECTOR_FACTORIES, createContext, getConnector, GithubConnector, SnowflakeConnector } from './index.js';

describe('connector registry contract', () => {
  it('every connector satisfies the shared contract', () => {
    for (const [platform, factory] of Object.entries(CONNECTOR_FACTORIES)) {
      const c = factory!();
      const conn = c.describe();
      expect(conn.platform).toBeTruthy();
      expect(conn.mode).toMatch(/read-only|read-write/);
      // Tool descriptors are well-formed and write tools are always audited.
      for (const t of c.tools()) {
        expect(t.name).toContain('.');
        expect(t.timeoutMs).toBeGreaterThan(0);
        if (t.access === 'write') expect(t.audit).toBe(true);
        expect(['low', 'medium', 'high']).toContain(t.risk);
      }
      // Advertised capabilities must have a corresponding method.
      if (c.capabilities.has('runs.get')) expect(typeof c.getRun).toBe('function');
      if (c.capabilities.has('issues.search')) expect(typeof c.searchIssues).toBe('function');
      expect(platform).toBeTruthy();
    }
  });

  it('default context denies writes and yields no secrets', async () => {
    const ctx = createContext();
    expect(await ctx.approve({ tool: 't', access: 'write', risk: 'high', summary: '', preview: '' })).toBe(false);
    expect(await ctx.getSecret('X')).toBeUndefined();
  });

  it('normalizes a failed GitHub Actions run into the shared model', async () => {
    const gh = new GithubConnector();
    const res = await gh.getRun(createContext(), '848271');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.platform).toBe('github-actions');
      expect(res.value.status).toBe('failed');
      expect(res.value.logs.some((l) => l.message.includes('SNOWFLAKE_PASSWORD'))).toBe(true);
    }
  });

  it('normalizes a failed Snowflake query', async () => {
    const sf = new SnowflakeConnector();
    const res = await sf.getRun(createContext(), '01af-fail');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.logs.some((l) => l.message.includes('invalid identifier'))).toBe(true);
  });

  it('returns NOT_FOUND for unknown ids', async () => {
    const res = await getConnector('snowflake')!.getRun!(createContext(), 'nope');
    expect(res.ok).toBe(false);
  });
});
