import type { Evidence, Investigation, RootCauseHypothesis } from '@pfa/core';

const EVIDENCE_LABEL: Record<Evidence['kind'], string> = {
  confirmed: '✓ Confirmed',
  strong_correlation: '≈ Strong correlation',
  inference: '~ Inference',
  assumption: '? Assumption',
  missing_information: '! Missing information',
};

function evidenceBlock(evidence: Evidence[]): string {
  if (evidence.length === 0) return '_No evidence recorded._';
  return evidence
    .map((e) => {
      const link = e.sourceRef?.url ? ` ([source](${e.sourceRef.url}))` : '';
      return `- **${EVIDENCE_LABEL[e.kind]}** — ${e.statement}${link}`;
    })
    .join('\n');
}

function hypothesisBlock(h: RootCauseHypothesis, index: number): string {
  const verify = h.recommendations.filter((r) => r.kind === 'verification');
  const remediate = h.recommendations.filter((r) => r.kind === 'remediation');
  return [
    `### ${index + 1}. ${h.title}`,
    '',
    `- **Category:** \`${h.category}\``,
    `- **Confidence:** ${h.confidence} (score ${h.score})`,
    `- **Rationale:** ${h.rationale}`,
    '',
    '**Evidence**',
    '',
    evidenceBlock(h.evidence),
    '',
    verify.length ? '**Verify**\n\n' + verify.map((r) => `- [ ] ${r.description}`).join('\n') : '',
    '',
    remediate.length
      ? '**Remediate**\n\n' + remediate.map((r) => `- [ ] ${r.description}`).join('\n')
      : '',
  ]
    .filter((l) => l !== '')
    .join('\n');
}

/** Render a full incident report in Markdown. Safe to write to disk or Jira. */
export function toMarkdown(inv: Investigation): string {
  const inc = inv.incident;
  const lines: string[] = [];

  lines.push(`# Incident Report: ${inc.title}`);
  lines.push('');
  lines.push(`> Generated ${inv.createdAt} · Investigation \`${inv.id}\``);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(inc.summary);
  lines.push('');

  lines.push('## Overview');
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Pipeline | ${inc.pipeline} |`);
  lines.push(`| Primary platform | ${inc.primaryPlatform} |`);
  lines.push(`| Failed stage | ${inc.failedStage ?? '—'} |`);
  lines.push(`| Category | \`${inc.category}\` |`);
  lines.push(`| Confidence | ${inc.confidence} |`);
  lines.push(`| Status | ${inv.status} |`);
  lines.push('');

  lines.push('## Root-cause hypotheses');
  lines.push('');
  if (inc.hypotheses.length === 0) {
    lines.push('_No hypotheses could be generated from the available evidence._');
  } else {
    inc.hypotheses.forEach((h, i) => {
      lines.push(hypothesisBlock(h, i));
      lines.push('');
    });
  }

  if (inv.diff) {
    lines.push('## Failed vs. successful run');
    lines.push('');
    const d = inv.diff;
    const section = (title: string, rows: { key: string; before?: string; after?: string }[]) => {
      if (rows.length === 0) return;
      lines.push(`**${title}**`, '', '| Key | Before | After |', '| --- | --- | --- |');
      for (const r of rows) lines.push(`| ${r.key} | ${r.before ?? '—'} | ${r.after ?? '—'} |`);
      lines.push('');
    };
    section('Changed parameters', d.changedParameters);
    section('Changed dependencies', d.changedDependencies);
    section('Changed configuration', d.changedConfig);
    section('Environment deltas', d.environmentDeltas);
    if (d.newErrors.length) {
      lines.push('**New errors not present in the baseline**', '');
      for (const e of d.newErrors.slice(0, 10)) lines.push(`- ${e}`);
      lines.push('');
    }
  }

  if (inc.relatedIssues.length) {
    lines.push('## Related incidents');
    lines.push('');
    for (const issue of inc.relatedIssues) {
      const link = issue.url ? `[${issue.key}](${issue.url})` : issue.key;
      const sim = issue.similarity ? ` — similarity ${(issue.similarity * 100) | 0}%` : '';
      lines.push(`- ${link}: ${issue.title}${sim}`);
    }
    lines.push('');
  }

  lines.push('## Evidence stream');
  lines.push('');
  lines.push('The deduped, redacted error lines that drove this analysis:');
  lines.push('');
  lines.push('```text');
  for (const e of inv.meaningfulErrors) lines.push(`[${e.seq}] ${e.message}`);
  lines.push('```');
  lines.push('');

  if (inv.notes.length) {
    lines.push('## Notes');
    lines.push('');
    for (const n of inv.notes) lines.push(`- ${n}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(
    '_Evidence labels: **✓ Confirmed** (observed fact), **≈ Strong correlation**, **~ Inference**, **? Assumption**, **! Missing information**. Verify before acting on remediation steps._',
  );
  return lines.join('\n');
}
