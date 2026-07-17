import * as vscode from 'vscode';
import { listPlatforms, getConnector } from '@pfa/connectors';

/** Connections tree — one node per available connector platform. */
export class ConnectionsProvider implements vscode.TreeDataProvider<ConnNode> {
  private _onDidChange = new vscode.EventEmitter<ConnNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  refresh(): void {
    this._onDidChange.fire(undefined);
  }
  getTreeItem(el: ConnNode): vscode.TreeItem {
    return el;
  }
  getChildren(): ConnNode[] {
    return listPlatforms().map((p) => {
      const c = getConnector(p);
      const item = new ConnNode(p, [...(c?.capabilities ?? [])].join(', '));
      return item;
    });
  }
}

class ConnNode extends vscode.TreeItem {
  constructor(platform: string, caps: string) {
    super(platform, vscode.TreeItemCollapsibleState.None);
    this.description = caps;
    this.iconPath = new vscode.ThemeIcon('plug');
    this.contextValue = 'pfaConnection';
  }
}

/** Recent failures — seeded from connector fixtures for the MVP. A live build
 *  would populate this from `listRuns({ status: 'failed' })`. */
export interface FailureRef {
  label: string;
  platform: string;
  runId: string;
  baselineId?: string;
}

const SAMPLE_FAILURES: FailureRef[] = [
  { label: 'Customer Revenue Pipeline (Databricks)', platform: 'databricks', runId: '551', baselineId: '540' },
  { label: 'data-pipeline (GitHub Actions)', platform: 'github-actions', runId: '848271', baselineId: '847900' },
  { label: 'Snowflake load query', platform: 'snowflake', runId: '01af-fail', baselineId: '01ae-ok' },
  { label: 'orders aggregation (MongoDB)', platform: 'mongodb', runId: 'op_9f' },
];

export class FailuresProvider implements vscode.TreeDataProvider<RunNode> {
  private _onDidChange = new vscode.EventEmitter<RunNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  refresh(): void {
    this._onDidChange.fire(undefined);
  }
  getTreeItem(el: RunNode): vscode.TreeItem {
    return el;
  }
  getChildren(): RunNode[] {
    return SAMPLE_FAILURES.map((f) => new RunNode(f));
  }
}

export class RunNode extends vscode.TreeItem {
  constructor(public readonly ref: FailureRef) {
    super(ref.label, vscode.TreeItemCollapsibleState.None);
    this.description = `${ref.platform} · ${ref.runId}`;
    this.iconPath = new vscode.ThemeIcon('error');
    this.contextValue = 'pfaRun';
    this.command = {
      command: 'pfa.investigateRun',
      title: 'Investigate',
      arguments: [ref],
    };
  }
}
