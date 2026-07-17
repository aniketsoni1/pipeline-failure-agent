import type { LogEvent } from '@pfa/core';

/**
 * Deny-by-default secret + PII redaction. Runs at the ingest boundary of every
 * connector, before data reaches the normalized model, reports, logs or AI.
 *
 * Patterns are ordered most-specific first. Each match is replaced with a typed
 * placeholder so downstream readers can see that redaction happened.
 */

export type RedactionLevel = 'strict' | 'standard' | 'none';

interface Rule {
  name: string;
  re: RegExp;
  replace: (m: string) => string;
  /** Only applied at 'strict' (e.g. broad PII like emails). */
  strictOnly?: boolean;
}

const mask = (label: string) => () => `«${label}:REDACTED»`;

const RULES: Rule[] = [
  // Connection strings (scheme://user:pass@host) — keep scheme + host, drop creds.
  {
    name: 'connection_string',
    re: /\b([a-z][a-z0-9+.-]*):\/\/([^\s:@/]+):([^\s@/]+)@([^\s/]+)/gi,
    replace: (m) => m.replace(/:\/\/([^\s:@/]+):([^\s@/]+)@/, '://«USER»:«SECRET»@'),
  },
  // AWS access key id
  { name: 'aws_access_key_id', re: /\bAKIA[0-9A-Z]{16}\b/g, replace: mask('AWS_KEY') },
  // AWS secret access key (heuristic: 40 char base64-ish following secret hints)
  {
    name: 'aws_secret',
    re: /\b(aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?([A-Za-z0-9/+]{40})['"]?/gi,
    replace: (m) => m.replace(/([A-Za-z0-9/+]{40})/, '«AWS_SECRET:REDACTED»'),
  },
  // GitHub tokens
  { name: 'github_token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, replace: mask('GITHUB_TOKEN') },
  // Slack tokens
  { name: 'slack_token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, replace: mask('SLACK_TOKEN') },
  // JWTs
  {
    name: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    replace: mask('JWT'),
  },
  // PEM private keys
  {
    name: 'private_key',
    re: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
    replace: mask('PRIVATE_KEY'),
  },
  // Bearer / Authorization headers
  {
    name: 'authorization_header',
    re: /\b(authorization|x-api-key)\s*[:=]\s*['"]?(bearer\s+)?[A-Za-z0-9._~+/=-]{12,}['"]?/gi,
    replace: (m) => m.replace(/[:=]\s*.*/i, ': «AUTH:REDACTED»'),
  },
  // Generic key=value secrets
  {
    name: 'generic_secret_kv',
    re: /\b(password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|client[_-]?secret|private[_-]?key)\b\s*[=:]\s*['"]?([^\s'"]{4,})['"]?/gi,
    replace: (m) => m.replace(/([=:]\s*['"]?)[^\s'"]{4,}/, '$1«SECRET:REDACTED»'),
  },
  // Emails (strict only — often benign in logs, but PII)
  {
    name: 'email',
    strictOnly: true,
    re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replace: mask('EMAIL'),
  },
];

export interface RedactionResult {
  text: string;
  hits: string[];
}

export function redactText(input: string, level: RedactionLevel = 'strict'): RedactionResult {
  if (level === 'none') return { text: input, hits: [] };
  let text = input;
  const hits: string[] = [];
  for (const rule of RULES) {
    if (rule.strictOnly && level !== 'strict') continue;
    if (rule.re.test(text)) {
      hits.push(rule.name);
      rule.re.lastIndex = 0;
      text = text.replace(rule.re, (m) => rule.replace(m));
    }
    rule.re.lastIndex = 0;
  }
  return { text, hits };
}

/** Redact a single log event, marking it as redacted. */
export function redactLogEvent(ev: LogEvent, level: RedactionLevel = 'strict'): LogEvent {
  const { text, hits } = redactText(ev.message, level);
  return { ...ev, message: text, redacted: ev.redacted || hits.length > 0 };
}

export function redactLogEvents(events: LogEvent[], level: RedactionLevel = 'strict'): {
  events: LogEvent[];
  hitCount: number;
} {
  let hitCount = 0;
  const out = events.map((ev) => {
    const r = redactText(ev.message, level);
    hitCount += r.hits.length;
    return { ...ev, message: r.text, redacted: ev.redacted || r.hits.length > 0 };
  });
  return { events: out, hitCount };
}

/** Mask specific config fields by key (case-insensitive). */
export function maskFields(
  values: Record<string, string>,
  fields: string[],
  level: RedactionLevel = 'strict',
): Record<string, string> {
  const lower = new Set(fields.map((f) => f.toLowerCase()));
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    out[k] = lower.has(k.toLowerCase()) ? '«REDACTED»' : redactText(v, level).text;
  }
  return out;
}
