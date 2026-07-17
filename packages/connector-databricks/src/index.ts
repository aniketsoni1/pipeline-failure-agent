import {
  appError,
  err,
  ok,
  type Capability,
  type Connection,
  type Connector,
  type ConnectorContext,
  type LogEvent,
  type Platform,
  type Result,
  type RunDetail,
  type ToolDescriptor,
} from '@pfa/core';
import { z } from 'zod';
import { parseLogText } from '@pfa/connector-local';

/**
 * Databricks connector. Diagnoses job/task failures, Spark exceptions, cluster
 * startup, library installs, Unity Catalog permissions, OOM and runtime drift.
 * Offline against recorded fixtures.
 */
export interface DbxRun {
  run_id: number;
  job_name: string;
  result_state: 'SUCCESS' | 'FAILED';
  start_time: string;
  tasks: { key: string; state: string; error?: string }[];
  cluster: { spark_version: string; node_type: string };
  libraries: Record<string, string>;
  driver_stderr?: string;
}

export const RUNS: Record<string, DbxRun> = {
  '551': {
    run_id: 551,
    job_name: 'Customer Revenue Pipeline',
    result_state: 'FAILED',
    start_time: '2026-07-15T08:00:00Z',
    tasks: [
      { key: 'bronze_ingest', state: 'SUCCESS' },
      {
        key: 'silver_transform',
        state: 'FAILED',
        error: "AnalysisException: cannot resolve '`customer_region`' given input columns: [region_code, id]",
      },
    ],
    cluster: { spark_version: '14.3.x-scala2.12', node_type: 'i3.xlarge' },
    libraries: { 'great-expectations': '0.18.8', pandas: '2.2.1' },
    driver_stderr:
      '2026-07-15T08:00:12Z ERROR AnalysisException: cannot resolve `customer_region` given input columns: [region_code, id]\n2026-07-15T08:00:12Z ERROR Task silver_transform failed',
  },
  '540': {
    run_id: 540,
    job_name: 'Customer Revenue Pipeline',
    result_state: 'SUCCESS',
    start_time: '2026-07-14T08:00:00Z',
    tasks: [
      { key: 'bronze_ingest', state: 'SUCCESS' },
      { key: 'silver_transform', state: 'SUCCESS' },
    ],
    cluster: { spark_version: '14.3.x-scala2.12', node_type: 'i3.xlarge' },
    libraries: { 'great-expectations': '0.18.8', pandas: '2.2.1' },
  },
};

function normalize(r: DbxRun): RunDetail {
  const logs: LogEvent[] = r.driver_stderr ? parseLogText(r.driver_stderr, 'silver_transform') : [];
  const failedTask = r.tasks.find((t) => t.state === 'FAILED');
  if (logs.length === 0 && failedTask?.error) {
    logs.push({ seq: 0, severity: 'error', source: failedTask.key, message: failedTask.error, redacted: false });
  }
  return {
    id: String(r.run_id),
    platform: 'databricks',
    pipeline: r.job_name,
    failedStage: failedTask?.key,
    status: r.result_state === 'SUCCESS' ? 'success' : 'failed',
    startedAt: r.start_time,
    sourceRef: { platform: 'databricks', nativeId: String(r.run_id), locator: { job: r.job_name } },
    logs,
    configs: [
      { id: 'libs', kind: 'libraries', values: r.libraries },
      { id: 'runtime', kind: 'runtime', values: { spark_version: r.cluster.spark_version, node_type: r.cluster.node_type } },
    ],
    raw: r,
  };
}

export class DatabricksConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'databricks';
  readonly capabilities = new Set<Capability>(['runs.get', 'logs.get']);
  constructor(id = 'databricks') {
    this.id = id;
  }
  describe(): Connection {
    return { id: this.id, platform: 'databricks', label: 'Databricks', credentialProvider: 'aws-secrets-manager', mode: 'read-only' };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async getRun(_ctx: ConnectorContext, id: string): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    const r = RUNS[id];
    if (!r) return err(appError('NOT_FOUND', `No job run ${id}`, { id }));
    return ok(normalize(r));
  }
  tools(): ToolDescriptor[] {
    return [
      dtool('databricks.get_job_run', 'Read a job run and its task states.'),
      dtool('databricks.get_task_output', 'Read a task driver log (redacted).'),
      dtool('databricks.get_cluster_events', 'Read cluster lifecycle events.'),
    ];
  }
}

function dtool(name: string, description: string): ToolDescriptor {
  return {
    name,
    description,
    input: z.object({}).passthrough(),
    output: z.object({}).passthrough(),
    access: 'read',
    risk: 'low',
    permissions: ['jobs:read'],
    redaction: 'strict',
    timeoutMs: 20000,
    retries: 2,
    audit: true,
  };
}
