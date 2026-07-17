import type { Investigation } from '@pfa/core';
import { toMarkdown } from './markdown.js';

export type OutputFormat = 'terminal' | 'json' | 'yaml' | 'markdown' | 'sarif' | 'html';

export function toJson(inv: Investigation): string {
  return JSON.stringify(inv, null, 2);
}

/** Minimal, dependency-free YAML emitter for the investigation summary. */
export function toYaml(inv: Investigation): string {
  const inc = inv.incident;
  const esc = (s: string) => (/[:#\n]/.test(s) ? JSON.stringify(s) : s);
  const lines = [
    `id: ${inv.id}`,
    `createdAt: ${inv.createdAt}`,
    `status: ${inv.status}`,
    'incident:',
    `  title: ${esc(inc.title)}`,
    `  pipeline: ${esc(inc.pipeline)}`,
    `  primaryPlatform: ${inc.primaryPlatform}`,
    `  category: ${inc.category}`,
    `  confidence: ${inc.confidence}`,
    '  hypotheses:',
  ];
  for (const h of inc.hypotheses) {
    lines.push(`    - title: ${esc(h.title)}`);
    lines.push(`      category: ${h.category}`);
    lines.push(`      confidence: ${h.confidence}`);
    lines.push(`      score: ${h.score}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * SARIF 2.1.0 — lets selected findings surface in GitHub code scanning. One
 * result per hypothesis; code refs become physical locations when present.
 */
export function toSarif(inv: Investigation): string {
  const rulesMap = new Map<string, { id: string; name: string }>();
  const results = inv.incident.hypotheses.map((h) => {
    rulesMap.set(h.category, { id: h.category, name: h.title });
    const codeRef = h.evidence.find((e) => e.codeRef)?.codeRef;
    return {
      ruleId: h.category,
      level: h.confidence === 'high' ? 'error' : h.confidence === 'medium' ? 'warning' : 'note',
      message: { text: `${h.title} — ${h.rationale}` },
      ...(codeRef
        ? {
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: codeRef.path },
                  ...(codeRef.line ? { region: { startLine: codeRef.line } } : {}),
                },
              },
            ],
          }
        : {}),
    };
  });

  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'pipeline-failure-agent',
            informationUri: 'https://github.com/your-org/pipeline-failure-agent',
            rules: [...rulesMap.values()].map((r) => ({
              id: r.id,
              name: r.name,
              shortDescription: { text: r.name },
            })),
          },
        },
        results,
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}

/** Self-contained HTML incident report (no external assets). */
export function toHtml(inv: Investigation): string {
  const body = toMarkdown(inv)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${inv.incident.title}</title>
<style>
  body{font:15px/1.55 -apple-system,Segoe UI,Roboto,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;color:#1b1f24}
  pre{white-space:pre-wrap;background:#0d1117;color:#e6edf3;padding:1rem;border-radius:8px;overflow:auto}
  .doc{white-space:pre-wrap}
  .badge{display:inline-block;padding:.1rem .5rem;border-radius:999px;background:#eef;font-size:.8rem}
</style></head>
<body><span class="badge">${inv.incident.confidence} confidence · ${inv.incident.category}</span>
<pre class="doc">${body}</pre></body></html>`;
}

export function render(inv: Investigation, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return toJson(inv);
    case 'yaml':
      return toYaml(inv);
    case 'sarif':
      return toSarif(inv);
    case 'html':
      return toHtml(inv);
    case 'markdown':
    case 'terminal':
    default:
      return toMarkdown(inv);
  }
}
