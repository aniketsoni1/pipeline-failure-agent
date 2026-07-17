import {
  appError,
  err,
  ok,
  type Capability,
  type ChangeEvent,
  type Connection,
  type Connector,
  type ConnectorContext,
  type LogEvent,
  type Platform,
  type Result,
  type Run,
  type RunDetail,
  type RunQuery,
  type ToolDescriptor,
} from '@pfa/core';
import { z } from 'zod';
import { parseLogText } from '@pfa/connector-local';
import { COMMITS, JOBS, LOGS, RUNS, type GhRun } from './fixtures.js';

/**
 * GitHub Actions connector. Offline by default against recorded fixtures; a live
 * transport (REST via fetch, or a GitHub App) implements the same `Transport`
 * seam. Analyzes workflow run failures, missing secrets, dependency changes,
 * and commit diffs.
 */
export interface GithubTransport {
  listRuns(): Promise<GhRun[]>;
  getRun(id: number): Promise<GhRun | undefined>;
  getLogs(id: number): Promise<string | undefined>;
  listCommits(): Promise<typeof COMMITS>;
}

export const fixtureTransport: GithubTransport = {
  async listRuns() {
    return RUNS;
  },
  async getRun(id) {
    return RUNS.find((r) => r.id === id);
  },
  async getLogs(id) {
    return LOGS[id];
  },
  async listCommits() {
    return COMMITS;
  },
};

function normalizeRun(raw: GhRun, logs: LogEvent[]): RunDetail {
  const jobs = JOBS[raw.id] ?? [];
  const failedStep = jobs
    .flatMap((j) => j.steps.map((s) => ({ job: j.name, ...s })))
    .find((s) => s.conclusion === 'failure');
  return {
    id: String(raw.id),
    platform: 'github-actions',
    pipeline: raw.name,
    failedStage: failedStep ? `${failedStep.job} / ${failedStep.name}` : undefined,
    status: raw.conclusion === 'success' ? 'success' : raw.conclusion === 'failure' ? 'failed' : 'unknown',
    startedAt: raw.run_started_at,
    finishedAt: raw.updated_at,
    sourceRef: {
      platform: 'github-actions',
      nativeId: String(raw.id),
      url: raw.html_url,
      locator: { branch: raw.head_branch, sha: raw.head_sha, workflow: raw.path },
    },
    logs,
    raw,
  };
}

export class GithubConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'github-actions';
  readonly capabilities = new Set<Capability>([
    'runs.list',
    'runs.get',
    'logs.get',
    'changes.search',
  ]);
  constructor(
    private readonly transport: GithubTransport = fixtureTransport,
    id = 'github',
  ) {
    this.id = id;
  }
  describe(): Connection {
    return {
      id: this.id,
      platform: 'github-actions',
      label: 'GitHub Actions',
      credentialProvider: 'env',
      mode: 'read-only',
    };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async listRuns(_ctx: ConnectorContext, q: RunQuery): Promise<Result<Run[], ReturnType<typeof appError>>> {
    const runs = await this.transport.listRuns();
    const filtered = runs.filter((r) =>
      q.status === 'failed'
        ? r.conclusion === 'failure'
        : q.status === 'success'
          ? r.conclusion === 'success'
          : true,
    );
    return ok(filtered.map((r) => normalizeRun(r, [])));
  }
  async getRun(_ctx: ConnectorContext, id: string): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    const raw = await this.transport.getRun(Number(id));
    if (!raw) return err(appError('NOT_FOUND', `No workflow run ${id}`, { id }));
    const text = (await this.transport.getLogs(Number(id))) ?? '';
    return ok(normalizeRun(raw, parseLogText(text)));
  }
  async searchChanges(): Promise<Result<ChangeEvent[], ReturnType<typeof appError>>> {
    const commits = await this.transport.listCommits();
    return ok(
      commits.map((c) => ({
        id: c.sha,
        platform: 'github' as Platform,
        kind: 'commit' as const,
        title: c.commit.message.split('\n')[0]!,
        timestamp: c.commit.author.date,
        author: c.commit.author.name,
        summary: c.commit.message,
        sourceRef: { platform: 'github', nativeId: c.sha, url: c.html_url },
      })),
    );
  }
  tools(): ToolDescriptor[] {
    return [
      tool('github.list_workflow_runs', 'List workflow runs.', 'read', 'low'),
      tool('github.get_workflow_logs', 'Download and parse workflow run logs.', 'read', 'low'),
      tool('github.compare_commits', 'Compare two commits/refs for relevant changes.', 'read', 'low'),
      {
        name: 'github.create_issue',
        description: 'Create a GitHub issue from an investigation report.',
        input: z.object({ title: z.string(), body: z.string() }),
        output: z.object({ number: z.number(), url: z.string() }),
        access: 'write',
        risk: 'medium',
        permissions: ['issues:write'],
        redaction: 'strict',
        timeoutMs: 15000,
        retries: 1,
        audit: true,
      },
    ];
  }
}

function tool(name: string, description: string, access: 'read' | 'write', risk: 'low' | 'medium' | 'high'): ToolDescriptor {
  return {
    name,
    description,
    input: z.object({}).passthrough(),
    output: z.object({}).passthrough(),
    access,
    risk,
    permissions: [access === 'read' ? 'repo:read' : 'repo:write'],
    redaction: 'strict',
    timeoutMs: 15000,
    retries: 2,
    audit: true,
  };
}

export * from './fixtures.js';
