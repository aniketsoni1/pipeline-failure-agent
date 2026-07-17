import type { FieldDiff, LogEvent, RunDetail, RunDiff } from '@pfa/core';
import { normalizeTemplate } from './dedup.js';

function diffRecords(
  before: Record<string, string> = {},
  after: Record<string, string> = {},
): FieldDiff[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: FieldDiff[] = [];
  for (const key of keys) {
    if (before[key] !== after[key]) out.push({ key, before: before[key], after: after[key] });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

/** Pull a flat dependency map out of config snapshots (e.g. requirements, libs). */
function dependencyMap(run: RunDetail): Record<string, string> {
  const deps: Record<string, string> = {};
  for (const cfg of run.configs ?? []) {
    if (cfg.kind === 'dependencies' || cfg.kind === 'libraries') {
      Object.assign(deps, cfg.values);
    }
  }
  return deps;
}

function envMap(run: RunDetail): Record<string, string> {
  const env: Record<string, string> = {};
  for (const cfg of run.configs ?? []) {
    if (cfg.kind === 'environment' || cfg.kind === 'runtime') Object.assign(env, cfg.values);
  }
  return env;
}

function errorTemplates(logs: LogEvent[]): Set<string> {
  return new Set(
    logs
      .filter((e) => e.severity === 'error' || e.severity === 'fatal')
      .map((e) => normalizeTemplate(e.message)),
  );
}

/**
 * Compare a failed run against a previous successful run. This is the "what
 * changed" step — the strongest deterministic signal for a probable cause.
 */
export function diffRuns(failed: RunDetail, baseline: RunDetail): RunDiff {
  const baseErrors = errorTemplates(baseline.logs);
  const newErrors = failed.logs
    .filter((e) => e.severity === 'error' || e.severity === 'fatal')
    .filter((e) => !baseErrors.has(normalizeTemplate(e.message)))
    .map((e) => e.message);

  return {
    failed: failed.sourceRef,
    baseline: baseline.sourceRef,
    changedParameters: diffRecords(baseline.parameters, failed.parameters),
    changedConfig: diffRecords(
      flattenConfigs(baseline),
      flattenConfigs(failed),
    ),
    changedDependencies: diffRecords(dependencyMap(baseline), dependencyMap(failed)),
    environmentDeltas: diffRecords(envMap(baseline), envMap(failed)),
    newErrors: [...new Set(newErrors)],
  };
}

function flattenConfigs(run: RunDetail): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const cfg of run.configs ?? []) {
    if (cfg.kind === 'dependencies' || cfg.kind === 'libraries') continue;
    for (const [k, v] of Object.entries(cfg.values)) flat[`${cfg.kind}.${k}`] = v;
  }
  return flat;
}
