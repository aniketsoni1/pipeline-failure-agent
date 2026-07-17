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

/**
 * MongoDB connector. Diagnoses operation/aggregation failures and performance
 * issues from explain() metadata and operational logs. Sampled document VALUES
 * are excluded by default — only shape/plan metadata is used.
 */
export interface MongoOperation {
  operation_id: string;
  db: string;
  collection: string;
  op: 'aggregate' | 'find' | 'update' | 'insert';
  duration_ms: number;
  plan_summary: string; // e.g. "COLLSCAN" or "IXSCAN { created_at: 1 }"
  docs_examined: number;
  docs_returned: number;
  error?: string;
}

export const OPERATIONS: Record<string, MongoOperation> = {
  op_9f: {
    operation_id: 'op_9f',
    db: 'analytics',
    collection: 'orders',
    op: 'aggregate',
    duration_ms: 8450,
    plan_summary: 'COLLSCAN',
    docs_examined: 4_200_000,
    docs_returned: 128,
    error: undefined,
  },
  op_dup: {
    operation_id: 'op_dup',
    db: 'analytics',
    collection: 'customers',
    op: 'insert',
    duration_ms: 12,
    plan_summary: 'IXSCAN',
    docs_examined: 1,
    docs_returned: 0,
    error: 'E11000 duplicate key error collection: analytics.customers index: email_1',
  },
};

function normalize(o: MongoOperation): RunDetail {
  const logs: LogEvent[] = [
    {
      seq: 0,
      severity: 'info',
      message: `${o.op} on ${o.db}.${o.collection} — plan ${o.plan_summary}, ${o.duration_ms} ms, examined ${o.docs_examined} / returned ${o.docs_returned}`,
      redacted: false,
    },
  ];
  if (o.error) {
    logs.push({ seq: 1, severity: 'error', source: `${o.db}.${o.collection}`, message: o.error, redacted: false });
  } else if (o.plan_summary.includes('COLLSCAN') && o.docs_examined > 10 * Math.max(1, o.docs_returned)) {
    logs.push({
      seq: 1,
      severity: 'error',
      source: `${o.db}.${o.collection}`,
      message: `COLLSCAN: no index available; examined ${o.docs_examined} docs to return ${o.docs_returned}`,
      redacted: false,
    });
  }
  return {
    id: o.operation_id,
    platform: 'mongodb',
    pipeline: `${o.db}.${o.collection} ${o.op}`,
    status: o.error || logs.some((l) => l.severity === 'error') ? 'failed' : 'success',
    durationMs: o.duration_ms,
    sourceRef: { platform: 'mongodb', nativeId: o.operation_id, locator: { db: o.db, collection: o.collection } },
    logs,
    raw: o,
  };
}

export class MongodbConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'mongodb';
  readonly capabilities = new Set<Capability>(['runs.get', 'logs.get']);
  constructor(id = 'mongodb') {
    this.id = id;
  }
  describe(): Connection {
    return { id: this.id, platform: 'mongodb', label: 'MongoDB', credentialProvider: 'aws-secrets-manager', mode: 'read-only' };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async getRun(_ctx: ConnectorContext, id: string): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    const o = OPERATIONS[id];
    if (!o) return err(appError('NOT_FOUND', `No operation ${id}`, { id }));
    return ok(normalize(o));
  }
  tools(): ToolDescriptor[] {
    return [
      mtool('mongodb.explain_query', 'Return the query plan (metadata only, no values).'),
      mtool('mongodb.inspect_indexes', 'List indexes on a collection.'),
      mtool('mongodb.sample_schema', 'Infer field/type shape (values redacted).'),
    ];
  }
}

function mtool(name: string, description: string): ToolDescriptor {
  return {
    name,
    description,
    input: z.object({}).passthrough(),
    output: z.object({}).passthrough(),
    access: 'read',
    risk: 'low',
    permissions: ['metadata:read'],
    redaction: 'strict',
    timeoutMs: 15000,
    retries: 2,
    audit: true,
  };
}
