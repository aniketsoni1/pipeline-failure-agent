import { promises as fs } from 'node:fs';
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
 * dbt connector — parses build artifacts (run_results.json + manifest.json).
 * No running warehouse is required: everything needed to diagnose model/test
 * failures is in the artifacts dbt writes to target/.
 */

interface DbtResult {
  status: string;
  unique_id: string;
  message?: string | null;
  failures?: number | null;
}
interface DbtRunResults {
  results: DbtResult[];
  metadata?: { generated_at?: string; invocation_id?: string };
}
interface DbtManifestNode {
  path?: string;
  original_file_path?: string;
  resource_type?: string;
}
interface DbtManifest {
  nodes?: Record<string, DbtManifestNode>;
}

export function parseDbtArtifacts(
  runResults: DbtRunResults,
  manifest?: DbtManifest,
  pipeline = 'dbt project',
): RunDetail {
  const nodes = manifest?.nodes ?? {};
  const logs: LogEvent[] = [];
  let seq = 0;
  let failedStage: string | undefined;

  for (const r of runResults.results) {
    const node = nodes[r.unique_id];
    const path = node?.original_file_path ?? node?.path;
    const isFail = r.status === 'error' || r.status === 'fail' || r.status === 'runtime error';
    const severity = isFail ? 'error' : r.status === 'warn' ? 'warning' : 'info';
    if (isFail && !failedStage) failedStage = r.unique_id;
    logs.push({
      seq: seq++,
      severity,
      source: r.unique_id,
      message: `[${r.status}] ${r.unique_id}${r.message ? `: ${r.message}` : ''}${
        r.failures ? ` (${r.failures} failing rows)` : ''
      }`,
      code: path ? { path } : undefined,
      redacted: false,
    });
  }

  return {
    id: runResults.metadata?.invocation_id ?? 'dbt-run',
    platform: 'dbt',
    pipeline,
    failedStage,
    status: logs.some((l) => l.severity === 'error') ? 'failed' : 'success',
    startedAt: runResults.metadata?.generated_at,
    sourceRef: {
      platform: 'dbt',
      nativeId: runResults.metadata?.invocation_id ?? 'dbt-run',
    },
    logs,
    raw: runResults,
  };
}

export async function ingestDbtTarget(targetDir: string, pipeline?: string): Promise<RunDetail> {
  const runResults = JSON.parse(await fs.readFile(`${targetDir}/run_results.json`, 'utf8'));
  let manifest: DbtManifest | undefined;
  try {
    manifest = JSON.parse(await fs.readFile(`${targetDir}/manifest.json`, 'utf8'));
  } catch {
    /* manifest optional */
  }
  return parseDbtArtifacts(runResults, manifest, pipeline);
}

export class DbtConnector implements Connector {
  readonly id: string;
  readonly platform: Platform = 'dbt';
  readonly capabilities = new Set<Capability>(['runs.get', 'logs.get']);
  constructor(id = 'dbt') {
    this.id = id;
  }
  describe(): Connection {
    return { id: this.id, platform: 'dbt', label: 'dbt artifacts', credentialProvider: 'none', mode: 'read-only' };
  }
  async healthCheck(): Promise<Result<{ ok: true }, ReturnType<typeof appError>>> {
    return ok({ ok: true });
  }
  async getRun(_ctx: ConnectorContext, id: string): Promise<Result<RunDetail, ReturnType<typeof appError>>> {
    try {
      return ok(await ingestDbtTarget(id));
    } catch (e) {
      return err(appError('NOT_FOUND', `Could not read dbt target: ${(e as Error).message}`, { id }));
    }
  }
  tools(): ToolDescriptor[] {
    return [
      {
        name: 'dbt.parse_run_results',
        description: 'Parse dbt run_results.json + manifest.json into normalized model failures.',
        input: z.object({ targetDir: z.string() }),
        output: z.object({ failed: z.number() }),
        access: 'read',
        risk: 'low',
        permissions: ['fs:read'],
        redaction: 'standard',
        timeoutMs: 5000,
        retries: 0,
        audit: true,
      },
    ];
  }
}
