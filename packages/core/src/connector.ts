import type { z } from 'zod';
import type { AppError, Result } from './result.js';
import type {
  ChangeEvent,
  Connection,
  Platform,
  Run,
  RunDetail,
  RunDiff,
  ExternalIssue,
} from './model.js';

/**
 * Capabilities a connector may advertise. The investigation engine only calls
 * methods it has confirmed are supported, so partial connectors are first-class.
 */
export type Capability =
  | 'runs.list'
  | 'runs.get'
  | 'runs.compare'
  | 'logs.get'
  | 'changes.search'
  | 'issues.search'
  | 'issues.create'
  | 'issues.comment';

export type ToolAccess = 'read' | 'write';
export type ToolRisk = 'low' | 'medium' | 'high';
export type RedactionPolicy = 'strict' | 'standard' | 'none';

/**
 * Every action an agent can take is declared as a ToolDescriptor. The permission
 * layer inspects these before execution — nothing runs that isn't declared here.
 */
export interface ToolDescriptor<I = unknown, O = unknown> {
  name: string;
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  access: ToolAccess;
  risk: ToolRisk;
  /** Coarse scopes the connection must hold, e.g. "repo:read". */
  permissions: string[];
  redaction: RedactionPolicy;
  timeoutMs: number;
  retries: number;
  /** Whether invocations are written to the audit log. */
  audit: boolean;
}

export interface ConnectorContext {
  /** Resolves a named credential without exposing it to the engine. */
  getSecret(name: string): Promise<string | undefined>;
  /** Structured, non-sensitive logger. */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void;
  /** Approval gate for write/high-risk tools. Returns true if allowed. */
  approve(request: ApprovalRequest): Promise<boolean>;
  now(): Date;
}

export interface ApprovalRequest {
  tool: string;
  access: ToolAccess;
  risk: ToolRisk;
  summary: string;
  /** Redacted preview of exactly what will be sent/changed. */
  preview: string;
}

export interface RunQuery {
  pipeline?: string;
  status?: 'failed' | 'success' | 'all';
  limit?: number;
}

/**
 * The single interface the engine, CLI and extension all program against.
 * Optional methods correspond to advertised capabilities.
 */
export interface Connector {
  readonly id: string;
  readonly platform: Platform;
  readonly capabilities: ReadonlySet<Capability>;

  describe(): Connection;
  /** Verify credentials / reachability. Read-only. */
  healthCheck(ctx: ConnectorContext): Promise<Result<{ ok: true }, AppError>>;

  listRuns?(ctx: ConnectorContext, q: RunQuery): Promise<Result<Run[], AppError>>;
  getRun?(ctx: ConnectorContext, id: string): Promise<Result<RunDetail, AppError>>;
  compareRuns?(
    ctx: ConnectorContext,
    failedId: string,
    baselineId: string,
  ): Promise<Result<RunDiff, AppError>>;
  searchChanges?(
    ctx: ConnectorContext,
    opts: { since?: string; near?: string },
  ): Promise<Result<ChangeEvent[], AppError>>;
  searchIssues?(
    ctx: ConnectorContext,
    query: string,
  ): Promise<Result<ExternalIssue[], AppError>>;

  /** The tools this connector exposes to the agent framework. */
  tools(): ToolDescriptor[];
}
