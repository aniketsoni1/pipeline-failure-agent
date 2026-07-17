import {
  CATEGORY_LABELS,
  shortId,
  type ChangeEvent,
  type Confidence,
  type Evidence,
  type ExternalIssue,
  type Recommendation,
  type RootCauseHypothesis,
  type RunDiff,
} from '@pfa/core';
import type { Classification } from '@pfa/rule-engine';
import type { EarliestFailure } from '@pfa/rule-engine';
import { GENERIC_PACK, KNOWLEDGE } from './knowledge.js';

export interface HypothesisInputs {
  classification: Classification;
  earliest?: EarliestFailure;
  diff?: RunDiff;
  changes: ChangeEvent[];
  relatedIssues: ExternalIssue[];
}

function toConfidence(score: number): Confidence {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function recommendationsFor(category: string): Recommendation[] {
  const pack = KNOWLEDGE[category as keyof typeof KNOWLEDGE] ?? GENERIC_PACK;
  const recs: Recommendation[] = [];
  for (const v of pack.verify) {
    recs.push({ id: shortId('v' + v), kind: 'verification', description: v, mutates: false });
  }
  for (const r of pack.remediate) {
    recs.push({ id: shortId('r' + r), kind: 'remediation', description: r, mutates: true });
  }
  return recs;
}

export function buildHypotheses(inp: HypothesisInputs): RootCauseHypothesis[] {
  const { classification, earliest, diff, changes, relatedIssues } = inp;
  const token = earliest?.match?.token;
  const hypotheses: RootCauseHypothesis[] = [];

  // ---- Primary hypothesis (from earliest meaningful failure + classification) ----
  const primaryCat = classification.primary;
  const evidence: Evidence[] = [];

  if (earliest) {
    evidence.push({
      id: shortId('e-earliest' + earliest.event.seq),
      kind: 'confirmed',
      statement: `Earliest meaningful error (line ${earliest.event.seq}): ${earliest.event.message}`,
      logSeq: earliest.event.seq,
      codeRef: earliest.match?.codeRef,
    });
  }

  let score = classification.confidenceScore;

  // Correlate a change event that mentions the failing token (e.g. renamed column).
  if (token) {
    const related = changes.find((c) =>
      `${c.title} ${c.summary}`.toLowerCase().includes(token.toLowerCase()),
    );
    if (related) {
      // A change event that literally references the failing token is the
      // strongest deterministic corroboration we can get without a re-run.
      score = Math.min(1, score + 0.25);
      evidence.push({
        id: shortId('e-change' + related.id),
        kind: 'strong_correlation',
        statement: `${related.kind} "${related.title}" references "${token}" and predates the failed run.`,
        sourceRef: related.sourceRef,
      });
    } else {
      evidence.push({
        id: shortId('e-token' + token),
        kind: 'inference',
        statement: `Failure centers on "${token}"; no correlated change was found in connected systems.`,
      });
    }
  }

  // Dependency / parameter diffs strengthen dependency & config hypotheses.
  if (diff) {
    if (diff.changedDependencies.length && primaryCat.startsWith('deps.')) {
      score = Math.min(1, score + 0.12);
      for (const d of diff.changedDependencies.slice(0, 5)) {
        evidence.push({
          id: shortId('e-dep' + d.key),
          kind: 'strong_correlation',
          statement: `Dependency ${d.key} changed ${d.before ?? '(absent)'} → ${d.after ?? '(absent)'} vs. last success.`,
        });
      }
    }
    if (diff.changedParameters.length) {
      for (const p of diff.changedParameters.slice(0, 5)) {
        evidence.push({
          id: shortId('e-param' + p.key),
          kind: 'inference',
          statement: `Parameter ${p.key} changed ${p.before ?? '(absent)'} → ${p.after ?? '(absent)'} vs. last success.`,
        });
      }
    }
  } else {
    evidence.push({
      id: shortId('e-nobaseline'),
      kind: 'missing_information',
      statement: 'No successful baseline run was supplied; cross-run comparison was skipped.',
    });
  }

  // Historical incidents provide precedent (inference, not proof) — a small bump.
  if (relatedIssues.length) score = Math.min(1, score + 0.03);
  for (const issue of relatedIssues.slice(0, 3)) {
    evidence.push({
      id: shortId('e-issue' + issue.key),
      kind: 'inference',
      statement: `Similar prior incident ${issue.key}: "${issue.title}"${
        issue.similarity ? ` (similarity ${(issue.similarity * 100) | 0}%)` : ''
      }.`,
      sourceRef: { platform: issue.platform, nativeId: issue.key, url: issue.url },
    });
  }

  hypotheses.push({
    id: shortId('h-primary' + primaryCat + (token ?? '')),
    category: primaryCat,
    title: earliest?.match?.title ?? CATEGORY_LABELS[primaryCat],
    rationale: earliest
      ? `The earliest meaningful failure matches the ${CATEGORY_LABELS[primaryCat]} pattern; later log lines are downstream effects.`
      : `Classification derived from aggregate error signatures (${CATEGORY_LABELS[primaryCat]}).`,
    confidence: toConfidence(score),
    score: Number(score.toFixed(3)),
    evidence,
    recommendations: recommendationsFor(primaryCat),
  });

  // ---- Secondary hypotheses (other categories with meaningful weight) ----
  for (const alt of classification.byCategory.slice(1, 3)) {
    const altScore = Math.min(0.6, alt.weight / 2);
    if (altScore < 0.25) continue;
    hypotheses.push({
      id: shortId('h-alt' + alt.category),
      category: alt.category,
      title: CATEGORY_LABELS[alt.category],
      rationale: `Secondary signal: ${alt.count} matching signature(s) for ${CATEGORY_LABELS[alt.category]}.`,
      confidence: toConfidence(altScore),
      score: Number(altScore.toFixed(3)),
      evidence: [
        {
          id: shortId('e-alt' + alt.category),
          kind: 'inference',
          statement: `${alt.count} signature match(es) contributed to this category.`,
        },
      ],
      recommendations: recommendationsFor(alt.category),
    });
  }

  return hypotheses.sort((a, b) => b.score - a.score);
}
