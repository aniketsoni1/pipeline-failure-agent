import {
  appError,
  err,
  ok,
  type Capability,
  type Connection,
  type Connector,
  type ConnectorContext,
  type ExternalIssue,
  type Platform,
  type Result,
  type ToolDescriptor,
} from '@pfa/core';
import { z } from 'zod';

/**
 * Jira connector — incident management + historical-knowledge base. Offline
 * against recorded issues; a live transport implements the same seam. Untrusted
 * issue text is never followed as instructions (see @pfa/security).
 */
export interface JiraIssueRecord {
  key: string;
  project: string;
  title: string;
  status: string;
  labels: string[];
  url: string;
}

export const ISSUES: JiraIssueRecord[] = [
  {
    key: 'DATA-184',
    project: 'DATA',
    title: 'Silver transform fails after customer_region column renamed',
    status: 'Done',
    labels: ['schema-drift', 'databricks', 'silver'],
    url: 'https://acme.atlassian.net/browse/DATA-184',
  },
  {
    key: 'DATA-140',
    project: 'DATA',
    title: 'Snowflake load fails: missing SNOWFLAKE_PASSWORD secret in CI',
    status: 'Done',
    labels: ['ci', 'secrets', 'github-actions'],
    url: 'https://acme.atlassian.net/browse/DATA-140',
  },
  {
    key: 'DATA-98',
    project: 'DATA',
    title: 'Orders aggregation slow — missing index on created_at',
    status: 'Done',
    labels: ['mongodb', 'performance', 'index'],
    url: 'https://acme.atlassian.net/browse/DATA-98',
  },
];

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      // Split on underscores too, so customer_region ≈ region_code share tokens.
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
}

/** Jaccard similarity over token sets — transparent and dependency-free. */
export function similarity(a: string, b: string): number {
  const sa = tokenize(a);
  const sb = tokenize(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

export interface JiraTransport {
  search(jql: string): Promise<JiraIssueRecord[]>;
  create(title: string, body: string): Promise<{ key: string; url: string }>;
  comment(key: string, body: string): Promise<void>;
}

let seq = 900;
export const fixtureJiraTransport: JiraTransport = {
  async search() {
    return ISSUES;
  },
  async create(_title) {
    const key = `DATA-${++seq}`;
    return { key, url: `https://acme.atlassian.net/browse/${key}` };
  },
  async comment() {
    /* no-op in fixture mode */
  },
};

export class JiraConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'jira';
  readonly capabilities = new Set<Capability>(['issues.search', 'issues.create', 'issues.comment']);
  constructor(
    private readonly transport: JiraTransport = fixtureJiraTransport,
    id = 'jira',
  ) {
    this.id = id;
  }
  describe(): Connection {
    return { id: this.id, platform: 'jira', label: 'Jira', credentialProvider: 'env', mode: 'read-only' };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async searchIssues(_ctx: ConnectorContext, query: string): Promise<Result<ExternalIssue[], ReturnType<typeof appError>>> {
    const rows = await this.transport.search(query);
    return ok(rows.map(toExternal));
  }
  /** Rank historical issues by similarity to a description. */
  async findSimilar(_ctx: ConnectorContext, description: string, min = 0.05): Promise<ExternalIssue[]> {
    const rows = await this.transport.search('');
    return rows
      .map((r) => ({ ...toExternal(r), similarity: similarity(description, `${r.title} ${r.labels.join(' ')}`) }))
      .filter((r) => (r.similarity ?? 0) >= min)
      .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
  }
  /** Create an issue — WRITE. Requires explicit approval via ctx.approve. */
  async createFromReport(
    ctx: ConnectorContext,
    title: string,
    body: string,
  ): Promise<Result<ExternalIssue, ReturnType<typeof appError>>> {
    const approved = await ctx.approve({
      tool: 'jira.create_issue',
      access: 'write',
      risk: 'medium',
      summary: `Create Jira issue "${title}"`,
      preview: body.slice(0, 800),
    });
    if (!approved) return err(appError('PERMISSION_DENIED', 'Issue creation was not approved.'));
    const created = await this.transport.create(title, body);
    ctx.log('info', 'Created Jira issue', { key: created.key });
    return ok({ id: created.key, platform: 'jira', key: created.key, title, url: created.url });
  }
  tools(): ToolDescriptor[] {
    return [
      {
        name: 'jira.search_issues',
        description: 'Search issues by JQL.',
        input: z.object({ jql: z.string() }),
        output: z.object({ issues: z.array(z.any()) }),
        access: 'read',
        risk: 'low',
        permissions: ['issues:read'],
        redaction: 'strict',
        timeoutMs: 15000,
        retries: 2,
        audit: true,
      },
      {
        name: 'jira.create_issue',
        description: 'Create an issue from an investigation report.',
        input: z.object({ title: z.string(), body: z.string() }),
        output: z.object({ key: z.string(), url: z.string() }),
        access: 'write',
        risk: 'medium',
        permissions: ['issues:write'],
        redaction: 'strict',
        timeoutMs: 15000,
        retries: 1,
        audit: true,
      },
      {
        name: 'jira.add_comment',
        description: 'Add structured evidence as a comment to an existing issue.',
        input: z.object({ key: z.string(), body: z.string() }),
        output: z.object({ ok: z.boolean() }),
        access: 'write',
        risk: 'low',
        permissions: ['issues:write'],
        redaction: 'strict',
        timeoutMs: 15000,
        retries: 1,
        audit: true,
      },
    ];
  }
}

function toExternal(r: JiraIssueRecord): ExternalIssue {
  return { id: r.key, platform: 'jira', key: r.key, title: r.title, status: r.status, url: r.url };
}
