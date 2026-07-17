import { redactText } from './redaction.js';

/**
 * Append-only, non-sensitive audit log of tool invocations and approvals.
 * Values are redacted before writing. The sink is injectable so the CLI can
 * write to disk and the extension can write to an output channel.
 */

export interface AuditEntry {
  timestamp: string;
  actor: 'agent' | 'user' | 'system';
  action: string;
  tool?: string;
  access?: 'read' | 'write';
  decision?: 'auto' | 'approved' | 'denied';
  target?: string;
  meta?: Record<string, unknown>;
}

export type AuditSink = (entry: AuditEntry) => void;

export class AuditLog {
  private entries: AuditEntry[] = [];
  constructor(private readonly sink?: AuditSink) {}

  record(entry: Omit<AuditEntry, 'timestamp'> & { timestamp?: string }): AuditEntry {
    const safe: AuditEntry = {
      ...entry,
      timestamp: entry.timestamp ?? new Date().toISOString(),
      target: entry.target ? redactText(entry.target).text : undefined,
    };
    this.entries.push(safe);
    this.sink?.(safe);
    return safe;
  }

  all(): readonly AuditEntry[] {
    return this.entries;
  }
}
