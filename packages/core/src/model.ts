import type { FailureCategory } from './categories.js';

/**
 * The normalized data model. Every connector maps its platform-specific payload
 * into these shapes. The raw payload is preserved on `raw` for traceability and
 * never interpreted by the engine.
 */

export type Platform =
  | 'local'
  | 'github'
  | 'github-actions'
  | 'databricks'
  | 'snowflake'
  | 'mongodb'
  | 'jira'
  | 'dbt'
  // reserved for future connectors — declared so the model is stable:
  | 'fabric'
  | 'airflow'
  | 'adf'
  | 'glue'
  | 'step-functions'
  | 'spark'
  | 'kafka'
  | 'fivetran'
  | 'dagster'
  | 'prefect'
  | 'business-central'
  | 'azure-devops'
  | 'servicenow'
  | 'slack'
  | 'teams';

export type Severity = 'info' | 'warning' | 'error' | 'fatal';
export type RunStatus = 'success' | 'failed' | 'cancelled' | 'running' | 'unknown';
export type Confidence = 'low' | 'medium' | 'high';

/** A reference back to the originating platform object, for deep links + audit. */
export interface SourceRef {
  platform: Platform;
  /** Stable identifier within the platform (run id, query id, issue key…). */
  nativeId: string;
  /** Optional deep link for humans (never contains credentials). */
  url?: string;
  /** Free-form, non-sensitive locators (repo, workspace, database…). */
  locator?: Record<string, string>;
}

export interface Connection {
  id: string;
  platform: Platform;
  label: string;
  /** Where the credential lives — never the credential itself. */
  credentialProvider: string;
  /** Read-only by default; write requires explicit opt-in. */
  mode: 'read-only' | 'read-write';
}

export interface CodeRef {
  path: string;
  line?: number;
  column?: number;
  symbol?: string;
  /** Commit or ref, when known. */
  revision?: string;
}

export interface LogEvent {
  /** Monotonic index within the retrieved log stream. */
  seq: number;
  timestamp?: string;
  severity: Severity;
  message: string;
  /** Logical source: stage/task/step/notebook cell/query id. */
  source?: string;
  code?: CodeRef;
  /** True once redaction has removed/masked sensitive spans. */
  redacted: boolean;
}

export interface ConfigSnapshot {
  id: string;
  /** e.g. workflow yaml, dbt profile, cluster spec, job params. */
  kind: string;
  /** Flattened key/value view, already redacted. */
  values: Record<string, string>;
  raw?: unknown;
}

export interface ChangeEvent {
  id: string;
  platform: Platform;
  kind: 'commit' | 'pull_request' | 'schema_change' | 'config_change' | 'deploy' | 'param_change';
  title: string;
  timestamp?: string;
  author?: string;
  /** Non-sensitive summary of what changed. */
  summary: string;
  sourceRef: SourceRef;
  codeRefs?: CodeRef[];
}

export interface Run {
  id: string;
  platform: Platform;
  pipeline: string;
  /** stage/task/step/query graph node that failed, when identifiable. */
  failedStage?: string;
  status: RunStatus;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  parameters?: Record<string, string>;
  sourceRef: SourceRef;
  /** The original, untouched platform payload. */
  raw?: unknown;
}

export interface RunDetail extends Run {
  logs: LogEvent[];
  configs?: ConfigSnapshot[];
  codeRefs?: CodeRef[];
}

/** Diff between a failed run and a previous successful run. */
export interface RunDiff {
  failed: SourceRef;
  baseline: SourceRef;
  changedParameters: FieldDiff[];
  changedConfig: FieldDiff[];
  changedDependencies: FieldDiff[];
  environmentDeltas: FieldDiff[];
  /** Log lines present in failed run but not baseline (deduped). */
  newErrors: string[];
}

export interface FieldDiff {
  key: string;
  before?: string;
  after?: string;
}

export interface Evidence {
  id: string;
  /** How much weight this carries. */
  kind: 'confirmed' | 'strong_correlation' | 'inference' | 'assumption' | 'missing_information';
  statement: string;
  sourceRef?: SourceRef;
  logSeq?: number;
  codeRef?: CodeRef;
}

export interface RootCauseHypothesis {
  id: string;
  category: FailureCategory;
  title: string;
  rationale: string;
  confidence: Confidence;
  /** 0..1 transparent score derived from evidence weights. */
  score: number;
  evidence: Evidence[];
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  kind: 'verification' | 'remediation';
  description: string;
  /** Whether acting on this would modify an external system. */
  mutates: boolean;
}

export interface ExternalIssue {
  id: string;
  platform: Platform;
  key: string;
  title: string;
  status?: string;
  url?: string;
  similarity?: number;
}

export interface Incident {
  id: string;
  title: string;
  primaryPlatform: Platform;
  pipeline: string;
  failedStage?: string;
  category: FailureCategory;
  confidence: Confidence;
  summary: string;
  createdAt: string;
  hypotheses: RootCauseHypothesis[];
  relatedIssues: ExternalIssue[];
}

/** The full output of an investigation run. */
export interface Investigation {
  id: string;
  createdAt: string;
  target: SourceRef;
  status: 'completed' | 'insufficient_evidence';
  incident: Incident;
  /** The normalized, deduped, redacted error stream that drove analysis. */
  meaningfulErrors: LogEvent[];
  diff?: RunDiff;
  changes: ChangeEvent[];
  /** Warnings surfaced to the user (e.g. connector degraded, redaction hits). */
  notes: string[];
}
