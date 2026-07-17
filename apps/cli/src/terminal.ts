import pc from 'picocolors';
import type { Confidence, Evidence, Investigation } from '@pfa/core';

const confColor = (c: Confidence) =>
  c === 'high' ? pc.green : c === 'medium' ? pc.yellow : pc.dim;

const EVIDENCE_MARK: Record<Evidence['kind'], string> = {
  confirmed: pc.green('✓'),
  strong_correlation: pc.cyan('≈'),
  inference: pc.blue('~'),
  assumption: pc.yellow('?'),
  missing_information: pc.dim('!'),
};

/** Human-readable terminal report. */
export function renderTerminal(inv: Investigation): string {
  const inc = inv.incident;
  const out: string[] = [];
  out.push('');
  out.push(pc.bold(`  ${inc.pipeline}`));
  out.push(pc.dim(`  ${inc.primaryPlatform} · investigation ${inv.id} · ${inv.status}`));
  out.push('');
  out.push(`  ${pc.dim('Probable root cause:')} ${pc.bold(inc.hypotheses[0]?.title ?? 'Unknown')}`);
  out.push(`  ${pc.dim('Category:')} ${inc.category}`);
  out.push(`  ${pc.dim('Confidence:')} ${confColor(inc.confidence)(inc.confidence)}`);
  if (inc.failedStage) out.push(`  ${pc.dim('Failed stage:')} ${inc.failedStage}`);
  out.push('');

  inc.hypotheses.forEach((h, i) => {
    out.push(`  ${pc.bold(`${i + 1}. ${h.title}`)}  ${confColor(h.confidence)(`[${h.confidence} ${h.score}]`)}`);
    for (const e of h.evidence) {
      out.push(`     ${EVIDENCE_MARK[e.kind]} ${e.statement}`);
    }
    const remediate = h.recommendations.filter((r) => r.kind === 'remediation');
    if (remediate.length) {
      out.push(pc.dim('     remediation:'));
      for (const r of remediate) out.push(pc.dim(`       • ${r.description}`));
    }
    out.push('');
  });

  if (inc.relatedIssues.length) {
    out.push(pc.dim('  Related incidents:'));
    for (const issue of inc.relatedIssues) {
      const sim = issue.similarity ? ` (${(issue.similarity * 100) | 0}%)` : '';
      out.push(`    - ${issue.key}: ${issue.title}${pc.dim(sim)}`);
    }
    out.push('');
  }

  if (inv.notes.length) {
    for (const n of inv.notes) out.push(pc.dim(`  · ${n}`));
    out.push('');
  }
  return out.join('\n');
}
