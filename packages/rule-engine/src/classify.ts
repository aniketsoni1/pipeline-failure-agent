import type { CodeRef, FailureCategory, LogEvent, Platform } from '@pfa/core';
import { SIGNATURES, type Signature } from './signatures.js';

export interface SignatureMatch {
  signature: Signature;
  event: LogEvent;
  token?: string;
  codeRef?: CodeRef;
  title: string;
}

function renderTitle(title: string, m: RegExpMatchArray): string {
  return title.replace(/\$(\d)/g, (_s, d) => m[Number(d)] ?? '').trim();
}

/** Run every signature over every event. Order preserved by event.seq. */
export function runSignatures(events: LogEvent[], platform?: Platform): SignatureMatch[] {
  const matches: SignatureMatch[] = [];
  for (const ev of events) {
    for (const sig of SIGNATURES) {
      if (sig.platform && platform && sig.platform !== platform) continue;
      const m = ev.message.match(sig.re);
      if (!m) continue;
      const extra = sig.extract?.(m) ?? {};
      matches.push({
        signature: sig,
        event: ev,
        token: extra.token,
        codeRef: extra.codeRef ?? ev.code,
        title: renderTitle(sig.title, m),
      });
    }
  }
  return matches;
}

export interface Classification {
  primary: FailureCategory;
  confidenceScore: number;
  matches: SignatureMatch[];
  byCategory: { category: FailureCategory; weight: number; count: number }[];
}

/**
 * Aggregate signature matches into a ranked category list. The winning category
 * is the highest summed weight; the score is normalized and transparent.
 */
export function classify(events: LogEvent[], platform?: Platform): Classification {
  const matches = runSignatures(events, platform);
  const tally = new Map<FailureCategory, { weight: number; count: number }>();
  for (const match of matches) {
    const cat = match.signature.category;
    const cur = tally.get(cat) ?? { weight: 0, count: 0 };
    cur.weight += match.signature.weight;
    cur.count += 1;
    tally.set(cat, cur);
  }
  const byCategory = [...tally.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.weight - a.weight);

  const top = byCategory[0];
  const primary: FailureCategory = top ? top.category : 'unknown';
  // Normalize: saturate around a couple of strong signals.
  const confidenceScore = top ? Math.min(1, top.weight / 1.6) : 0;
  return { primary, confidenceScore, matches, byCategory };
}
