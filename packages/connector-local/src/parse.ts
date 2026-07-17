import type { CodeRef, LogEvent, Severity } from '@pfa/core';

/**
 * Deterministic log parser for local Python / SQL / dbt / generic text logs.
 * Assigns a severity to each line and extracts code references from Python
 * traceback frames. No platform SDK required.
 */

const LEVEL_TOKEN = /\b(FATAL|CRITICAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|TRACE)\b/;

// Error-implying patterns that may appear without an explicit level token.
const ERROR_PATTERNS: RegExp[] = [
  /Traceback \(most recent call last\)/i,
  /\b\w*(Error|Exception):/,
  /KeyError|ValueError|TypeError|ModuleNotFoundError|FileNotFoundError|MemoryError/,
  /invalid identifier|SQL compilation error|does not exist or not authorized/i,
  /AnalysisException|OutOfMemoryError|ConcurrentAppendException/,
  /E11000 duplicate key|Authentication failed|COLLSCAN/,
  /Input required and not supplied|Bad credentials|ERESOLVE/,
  /\bfailed\b|\bfatal\b/i,
];

const CODEREF_RE = /File "([^"]+)", line (\d+)(?:, in (\S+))?/;

function severityOf(line: string): Severity {
  const m = line.match(LEVEL_TOKEN);
  if (m) {
    const t = m[1]!.toUpperCase();
    if (t === 'FATAL' || t === 'CRITICAL') return 'fatal';
    if (t === 'ERROR' || t === 'ERR') return 'error';
    if (t === 'WARN' || t === 'WARNING') return 'warning';
    return 'info';
  }
  if (ERROR_PATTERNS.some((re) => re.test(line))) return 'error';
  return 'info';
}

function timestampOf(line: string): string | undefined {
  const m = line.match(
    /\b(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/,
  );
  return m?.[1];
}

function codeRefOf(line: string): CodeRef | undefined {
  const m = line.match(CODEREF_RE);
  if (!m) return undefined;
  return { path: m[1]!, line: Number(m[2]), symbol: m[3] };
}

/** Parse raw log text into normalized LogEvents. Empty lines are dropped. */
export function parseLogText(text: string, source?: string): LogEvent[] {
  const lines = text.split(/\r?\n/);
  const events: LogEvent[] = [];
  let seq = 0;
  let pendingCodeRef: CodeRef | undefined;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (line.trim() === '') continue;

    const codeRef = codeRefOf(line);
    if (codeRef) {
      // Remember the frame; attach it to the following exception line.
      pendingCodeRef = codeRef;
    }

    const severity = severityOf(line);
    const event: LogEvent = {
      seq: seq++,
      severity,
      message: line.trim(),
      redacted: false,
    };
    const ts = timestampOf(line);
    if (ts) event.timestamp = ts;
    if (source) event.source = source;

    // Attach the most recent traceback frame to the exception summary line.
    if (severity === 'error' && !codeRef && pendingCodeRef && /(Error|Exception):/.test(line)) {
      event.code = pendingCodeRef;
      pendingCodeRef = undefined;
    } else if (codeRef) {
      event.code = codeRef;
    }

    events.push(event);
  }
  return events;
}
