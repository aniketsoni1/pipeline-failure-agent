import * as vscode from 'vscode';
import type { Investigation } from '@pfa/core';

/** A single reused webview panel that renders the incident report. */
export class ReportPanel {
  private static current: ReportPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  static show(inv: Investigation): void {
    if (ReportPanel.current) {
      ReportPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      ReportPanel.current.panel.webview.html = ReportPanel.render(inv);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'pfaReport',
      'Incident Report',
      vscode.ViewColumn.Beside,
      { enableScripts: false, retainContextWhenHidden: true },
    );
    ReportPanel.current = new ReportPanel(panel, inv);
  }

  private constructor(panel: vscode.WebviewPanel, inv: Investigation) {
    this.panel = panel;
    this.panel.webview.html = ReportPanel.render(inv);
    this.panel.onDidDispose(() => (ReportPanel.current = undefined));
  }

  private static render(inv: Investigation): string {
    const inc = inv.incident;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const hyp = inc.hypotheses
      .map(
        (h, i) => `
      <section class="hyp">
        <h3>${i + 1}. ${esc(h.title)} <span class="badge ${h.confidence}">${h.confidence} · ${h.score}</span></h3>
        <ul>${h.evidence.map((e) => `<li><b>${e.kind}</b> — ${esc(e.statement)}</li>`).join('')}</ul>
        ${
          h.recommendations.filter((r) => r.kind === 'remediation').length
            ? `<p class="rem">Remediation:</p><ul>${h.recommendations
                .filter((r) => r.kind === 'remediation')
                .map((r) => `<li>${esc(r.description)}</li>`)
                .join('')}</ul>`
            : ''
        }
      </section>`,
      )
      .join('');
    const related = inc.relatedIssues
      .map((r) => `<li>${esc(r.key)}: ${esc(r.title)} ${r.similarity ? `(${(r.similarity * 100) | 0}%)` : ''}</li>`)
      .join('');

    return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);padding:1rem}
  h2{margin-top:0}
  .badge{font-size:.75rem;padding:.1rem .4rem;border-radius:6px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground)}
  .badge.high{background:#2ea04366}.badge.medium{background:#d2992266}.badge.low{background:#8884}
  .hyp{border-left:3px solid var(--vscode-textLink-foreground);padding-left:.8rem;margin:1rem 0}
  .rem{margin:.4rem 0 0;font-weight:600}
  code{background:var(--vscode-textCodeBlock-background);padding:.1rem .3rem;border-radius:4px}
</style></head><body>
  <h2>${esc(inc.title)}</h2>
  <p>${esc(inc.summary)}</p>
  <p>Platform <code>${inc.primaryPlatform}</code> · Category <code>${inc.category}</code> · Confidence <b>${inc.confidence}</b></p>
  <h3>Root-cause hypotheses</h3>
  ${hyp}
  ${related ? `<h3>Related incidents</h3><ul>${related}</ul>` : ''}
  ${inv.notes.length ? `<h3>Notes</h3><ul>${inv.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
</body></html>`;
  }
}
