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
  type RunDetail,
  type ToolDescriptor,
} from '@pfa/core';
import { z } from 'zod';

/**
 * Snowflake connector. Works from QUERY_HISTORY / query metadata — never raw
 * business rows (redaction policy). Offline against recorded fixtures.
 */
export interface SnowflakeQuery {
  query_id: string;
  query_text: string;
  execution_status: 'SUCCESS' | 'FAIL';
  error_code?: string;
  error_message?: string;
  warehouse_name: string;
  start_time: string;
  total_elapsed_time_ms: number;
  rows_produced?: number;
}

export const QUERIES: Record<string, SnowflakeQuery> = {
  '01af-fail': {
    query_id: '01af-fail',
    query_text: 'INSERT INTO silver.customers SELECT customer_region FROM raw.customers',
    execution_status: 'FAIL',
    error_code: '000904',
    error_message: "SQL compilation error: invalid identifier 'CUSTOMER_REGION'",
    warehouse_name: 'ETL_WH',
    start_time: '2026-07-15T08:00:03Z',
    total_elapsed_time_ms: 412,
  },
  '01ae-ok': {
    query_id: '01ae-ok',
    query_text: 'INSERT INTO silver.customers SELECT region_code FROM raw.customers',
    execution_status: 'SUCCESS',
    warehouse_name: 'ETL_WH',
    start_time: '2026-07-14T08:00:03Z',
    total_elapsed_time_ms: 388,
    rows_produced: 12400,
  },
};

function normalize(q: SnowflakeQuery): RunDetail {
  const logs: LogEvent[] = [
    {
      seq: 0,
      severity: 'info',
      timestamp: q.start_time,
      message: `Query ${q.query_id} on ${q.warehouse_name} (${q.total_elapsed_time_ms} ms)`,
      redacted: false,
    },
  ];
  if (q.execution_status === 'FAIL' && q.error_message) {
    logs.push({
      seq: 1,
      severity: 'error',
      timestamp: q.start_time,
      source: q.query_id,
      message: `${q.error_code}: ${q.error_message}`,
      redacted: false,
    });
  }
  return {
    id: q.query_id,
    platform: 'snowflake',
    pipeline: 'Snowflake query',
    status: q.execution_status === 'SUCCESS' ? 'success' : 'failed',
    startedAt: q.start_time,
    durationMs: q.total_elapsed_time_ms,
    sourceRef: { platform: 'snowflake', nativeId: q.query_id, locator: { warehouse: q.warehouse_name } },
    logs,
    configs: [{ id: 'query', kind: 'query', values: { text: q.query_text, warehouse: q.warehouse_name } }],
    raw: q,
  };
}

export class SnowflakeConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'snowflake';
  readonly capabilities = new Set<Capability>(['runs.get', 'logs.get', 'changes.search']);
  constructor(id = 'snowflake') {
    this.id = id;
  }
  describe(): Connection {
    return { id: this.id, platform: 'snowflake', label: 'Snowflake', credentialProvider: 'aws-secrets-manager', mode: 'read-only' };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async getRun(_ctx: ConnectorContext, id: string): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    const q = QUERIES[id];
    if (!q) return err(appError('NOT_FOUND', `No query ${id}`, { id }));
    return ok(normalize(q));
  }
  async searchChanges(): Promise<Result<ChangeEvent[], ReturnType<typeof appError>>> {
    return ok([
      {
        id: 'alter-1',
        platform: 'snowflake',
        kind: 'schema_change',
        title: 'ALTER TABLE raw.customers RENAME COLUMN customer_region TO region_code',
        timestamp: '2026-07-15T07:50:00Z',
        summary: 'Column customer_region renamed to region_code on raw.customers before the failed run.',
        sourceRef: { platform: 'snowflake', nativeId: 'raw.customers' },
      },
    ]);
  }
  tools(): ToolDescriptor[] {
    return [
      simpleTool('snowflake.get_query_history', 'Read query history metadata.', 'read', 'low'),
      simpleTool('snowflake.get_query_profile', 'Read the execution profile for a query.', 'read', 'low'),
      simpleTool('snowflake.describe_object', 'Describe a database object (metadata only).', 'read', 'low'),
    ];
  }
}

function simpleTool(name: string, description: string, access: 'read' | 'write', risk: 'low' | 'medium' | 'high'): ToolDescriptor {
  return {
    name,
    description,
    input: z.object({}).passthrough(),
    output: z.object({}).passthrough(),
    access,
    risk,
    permissions: ['metadata:read'],
    redaction: 'strict',
    timeoutMs: 20000,
    retries: 2,
    audit: true,
  };
}
