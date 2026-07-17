import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import pc from 'picocolors';
import type { ApprovalRequest, ConnectorContext } from '@pfa/core';
import { defaultRegistry } from '@pfa/configuration';
import { AuditLog } from '@pfa/security';
import { createContext } from '@pfa/connectors';

export interface CliContextOptions {
  /** If true, write operations auto-deny (non-interactive/CI). */
  nonInteractive?: boolean;
  /** If true, pre-approve write operations (dangerous; requires explicit flag). */
  yes?: boolean;
  quiet?: boolean;
}

export function createCliContext(opts: CliContextOptions = {}): {
  ctx: ConnectorContext;
  audit: AuditLog;
} {
  const registry = defaultRegistry();
  const audit = new AuditLog((e) => {
    if (!opts.quiet) process.stderr.write(pc.dim(`audit ${e.timestamp} ${e.action}\n`));
  });

  const approve = async (req: ApprovalRequest): Promise<boolean> => {
    audit.record({ actor: 'agent', action: `request:${req.tool}`, tool: req.tool, access: req.access });
    if (opts.yes) {
      audit.record({ actor: 'user', action: `approve:${req.tool}`, tool: req.tool, decision: 'approved' });
      return true;
    }
    if (opts.nonInteractive) {
      audit.record({ actor: 'system', action: `deny:${req.tool}`, tool: req.tool, decision: 'denied' });
      return false;
    }
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      process.stdout.write(pc.yellow(`\n⚠ Approval required — ${req.summary}\n`));
      process.stdout.write(pc.dim(`Preview:\n${req.preview}\n`));
      const answer = (await rl.question(pc.bold(`Proceed with ${req.access} operation? [y/N] `))).trim().toLowerCase();
      const approved = answer === 'y' || answer === 'yes';
      audit.record({
        actor: 'user',
        action: `${approved ? 'approve' : 'deny'}:${req.tool}`,
        tool: req.tool,
        decision: approved ? 'approved' : 'denied',
      });
      return approved;
    } finally {
      rl.close();
    }
  };

  const ctx = createContext({
    getSecret: (name) => registry.get('env', name),
    approve,
    onLog: (level, message, meta) => {
      if (!opts.quiet) process.stderr.write(pc.dim(`[${level}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}\n`));
    },
  });

  return { ctx, audit };
}
