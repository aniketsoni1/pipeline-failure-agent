import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { configSchema, type PfaConfig } from '@pfa/core';

export const DEFAULT_CONFIG_DIR = process.env.PFA_HOME ?? join(homedir(), '.pfa');
export const DEFAULT_CONFIG_PATH = join(DEFAULT_CONFIG_DIR, 'config.json');

export function defaultConfig(): PfaConfig {
  return configSchema.parse({});
}

/** Load + validate config. Returns defaults if the file does not exist. */
export async function loadConfig(path = DEFAULT_CONFIG_PATH): Promise<PfaConfig> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return configSchema.parse(parsed);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return defaultConfig();
    throw new Error(`Invalid config at ${path}: ${(e as Error).message}`);
  }
}

/** Persist config (non-secret only — schema forbids secret fields). */
export async function saveConfig(config: PfaConfig, path = DEFAULT_CONFIG_PATH): Promise<void> {
  const validated = configSchema.parse(config);
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(validated, null, 2) + '\n', { mode: 0o600 });
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Lightweight environment diagnostics for `pipeline-agent doctor`. */
export async function runDoctor(config: PfaConfig, path = DEFAULT_CONFIG_PATH): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];
  checks.push({
    name: 'node',
    ok: Number(process.versions.node.split('.')[0]) >= 18,
    detail: `Node ${process.versions.node}`,
  });
  let configExists = false;
  try {
    await fs.access(path);
    configExists = true;
  } catch {
    /* not fatal */
  }
  checks.push({
    name: 'config',
    ok: true,
    detail: configExists ? `Found ${path}` : `No config yet (run 'pipeline-agent init')`,
  });
  checks.push({
    name: 'connections',
    ok: true,
    detail: `${config.connections.length} configured`,
  });
  checks.push({
    name: 'redaction',
    ok: config.security.redaction !== 'none',
    detail: `redaction=${config.security.redaction}`,
  });
  checks.push({
    name: 'telemetry',
    ok: config.security.telemetry === false,
    detail: 'telemetry disabled',
  });
  checks.push({
    name: 'ai',
    ok: true,
    detail: config.ai.enabled ? `enabled (${config.ai.provider ?? 'unset'})` : 'disabled (local-only)',
  });
  return checks;
}
