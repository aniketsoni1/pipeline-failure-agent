import * as vscode from 'vscode';
import type { ApprovalRequest, ConnectorContext } from '@pfa/core';
import { createContext } from '@pfa/connectors';

/**
 * ConnectorContext backed by VS Code: secrets come from SecretStorage, approvals
 * from a modal dialog. Same interface the CLI implements with readline.
 */
export function createVsCodeContext(ext: vscode.ExtensionContext): ConnectorContext {
  const channel = vscode.window.createOutputChannel('Pipeline Failure Agent');
  return createContext({
    getSecret: (name) => ext.secrets.get(name),
    approve: async (req: ApprovalRequest): Promise<boolean> => {
      const choice = await vscode.window.showWarningMessage(
        `Approval required — ${req.summary}`,
        { modal: true, detail: req.preview },
        'Approve',
        'Deny',
      );
      channel.appendLine(`[approval] ${req.tool} (${req.access}) → ${choice ?? 'Deny'}`);
      return choice === 'Approve';
    },
    onLog: (level, message, meta) =>
      channel.appendLine(`[${level}] ${message}${meta ? ' ' + JSON.stringify(meta) : ''}`),
  });
}
