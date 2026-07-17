import * as vscode from 'vscode';
import type { Investigation } from '@pfa/core';
import { investigateRun, investigatePlatformRun } from '@pfa/agent';
import { runFromLogText } from '@pfa/connector-local';
import { listPlatforms, JiraConnector } from '@pfa/connectors';
import { toMarkdown } from '@pfa/reporting';
import type { RedactionLevel } from '@pfa/security';
import { ConnectionsProvider, FailuresProvider, type FailureRef } from './tree.js';
import { ReportPanel } from './webview.js';
import { createVsCodeContext } from './context.js';

let lastInvestigation: Investigation | undefined;

function options(): { redaction: RedactionLevel; correlate: boolean } {
  const cfg = vscode.workspace.getConfiguration('pfa');
  return {
    redaction: cfg.get<RedactionLevel>('redaction', 'strict'),
    correlate: cfg.get<boolean>('correlate', true),
  };
}

export function activate(ext: vscode.ExtensionContext): void {
  const connections = new ConnectionsProvider();
  const failures = new FailuresProvider();
  ext.subscriptions.push(
    vscode.window.registerTreeDataProvider('pfaConnections', connections),
    vscode.window.registerTreeDataProvider('pfaFailures', failures),
  );

  const ctx = createVsCodeContext(ext);

  ext.subscriptions.push(
    vscode.commands.registerCommand('pfa.refresh', () => {
      connections.refresh();
      failures.refresh();
    }),

    vscode.commands.registerCommand('pfa.investigateActiveFile', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a log file to investigate.');
        return;
      }
      await withProgress('Investigating log…', async () => {
        const run = runFromLogText(editor.document.getText(), {}, editor.document.fileName);
        lastInvestigation = await investigateRun(ctx, run, options());
        ReportPanel.show(lastInvestigation);
      });
    }),

    vscode.commands.registerCommand('pfa.investigateRun', async (ref?: FailureRef) => {
      let platform = ref?.platform;
      let runId = ref?.runId;
      if (!platform) {
        platform = await vscode.window.showQuickPick(listPlatforms(), { placeHolder: 'Platform' });
        if (!platform) return;
      }
      if (!runId) {
        runId = await vscode.window.showInputBox({ prompt: `Run/query/operation id for ${platform}` });
        if (!runId) return;
      }
      await withProgress(`Investigating ${platform} ${runId}…`, async () => {
        lastInvestigation = await investigatePlatformRun(ctx, platform!, runId!, {
          ...options(),
          baselineId: ref?.baselineId,
        });
        ReportPanel.show(lastInvestigation);
      });
    }),

    vscode.commands.registerCommand('pfa.exportReport', async () => {
      if (!lastInvestigation) {
        vscode.window.showWarningMessage('Run an investigation first.');
        return;
      }
      const uri = await vscode.window.showSaveDialog({
        filters: { Markdown: ['md'] },
        saveLabel: 'Export incident report',
      });
      if (!uri) return;
      await vscode.workspace.fs.writeFile(uri, Buffer.from(toMarkdown(lastInvestigation), 'utf8'));
      vscode.window.showInformationMessage(`Report written to ${uri.fsPath}`);
    }),

    vscode.commands.registerCommand('pfa.createJiraIssue', async () => {
      if (!lastInvestigation) {
        vscode.window.showWarningMessage('Run an investigation first.');
        return;
      }
      const body = toMarkdown(lastInvestigation);
      const res = await new JiraConnector().createFromReport(ctx, lastInvestigation.incident.title, body);
      if (res.ok) vscode.window.showInformationMessage(`Created ${res.value.key}`);
      else vscode.window.showWarningMessage(res.error.message);
    }),
  );
}

export function deactivate(): void {
  /* nothing to clean up */
}

function withProgress<T>(title: string, task: () => Promise<T>): Thenable<T> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title },
    async () => {
      try {
        return await task();
      } catch (e) {
        vscode.window.showErrorMessage(`Pipeline Agent: ${(e as Error).message}`);
        throw e;
      }
    },
  );
}
