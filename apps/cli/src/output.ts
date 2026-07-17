import { promises as fs } from 'node:fs';
import type { Confidence, Investigation } from '@pfa/core';
import { render, type OutputFormat } from '@pfa/reporting';
import { renderTerminal } from './terminal.js';

export function renderInvestigation(inv: Investigation, format: OutputFormat): string {
  return format === 'terminal' ? renderTerminal(inv) : render(inv, format);
}

export async function emit(content: string, outputPath?: string): Promise<void> {
  if (outputPath) {
    await fs.writeFile(outputPath, content.endsWith('\n') ? content : content + '\n');
    process.stdout.write(`Wrote ${outputPath}\n`);
  } else {
    process.stdout.write(content + '\n');
  }
}

const RANK: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };

/** Returns true if the incident meets or exceeds the fail-on threshold. */
export function shouldFail(inv: Investigation, failOn?: Confidence): boolean {
  if (!failOn) return false;
  return RANK[inv.incident.confidence] >= RANK[failOn];
}
