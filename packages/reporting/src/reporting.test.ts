import { describe, it, expect } from 'vitest';
import type { Investigation } from '@pfa/core';
import { toMarkdown, toJson, toSarif, render } from './index.js';

const inv: Investigation = {
  id: 'inv1',
  createdAt: '2026-01-01T00:00:00Z',
  target: { platform: 'local', nativeId: 'run-1' },
  status: 'completed',
  meaningfulErrors: [{ seq: 2, severity: 'error', message: "KeyError: 'region'", redacted: true }],
  changes: [],
  notes: ['Redacted 1 sensitive value(s) before analysis.'],
  incident: {
    id: 'inc1',
    title: 'Revenue Pipeline: Missing key/column: region',
    primaryPlatform: 'local',
    pipeline: 'Revenue Pipeline',
    failedStage: 'silver',
    category: 'schema.missing_column',
    confidence: 'high',
    summary: 'Revenue Pipeline failed with probable cause: missing column region.',
    createdAt: '2026-01-01T00:00:00Z',
    relatedIssues: [],
    hypotheses: [
      {
        id: 'h1',
        category: 'schema.missing_column',
        title: 'Missing key/column: region',
        rationale: 'earliest error matches missing-column pattern',
        confidence: 'high',
        score: 0.8,
        evidence: [
          { id: 'e1', kind: 'confirmed', statement: "KeyError: 'region'", logSeq: 2, codeRef: { path: 'etl.py', line: 42 } },
        ],
        recommendations: [
          { id: 'r1', kind: 'verification', description: 'Check schema', mutates: false },
          { id: 'r2', kind: 'remediation', description: 'Rename mapping', mutates: true },
        ],
      },
    ],
  },
};

describe('reporting', () => {
  it('renders markdown with hypotheses and checkboxes', () => {
    const md = toMarkdown(inv);
    expect(md).toContain('# Incident Report');
    expect(md).toContain('schema.missing_column');
    expect(md).toContain('- [ ] Check schema');
    expect(md).toContain('Evidence stream');
  });

  it('renders valid JSON', () => {
    const parsed = JSON.parse(toJson(inv));
    expect(parsed.incident.category).toBe('schema.missing_column');
  });

  it('renders SARIF with a rule and a physical location', () => {
    const sarif = JSON.parse(toSarif(inv));
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results[0].ruleId).toBe('schema.missing_column');
    expect(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe('etl.py');
  });

  it('render() dispatches by format', () => {
    expect(render(inv, 'yaml')).toContain('category: schema.missing_column');
    expect(render(inv, 'html')).toContain('<!doctype html>');
  });
});
