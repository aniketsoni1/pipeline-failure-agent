# Security Policy

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Email
`security@your-org.example` (or use GitHub private vulnerability reporting). We aim
to acknowledge within 3 business days and to provide a remediation timeline after
triage.

## Scope highlights

- Secret redaction runs at every connector ingest boundary before analysis,
  reporting, storage, or AI.
- Write operations require explicit approval; the default context denies them.
- Untrusted content (logs, Jira/PR text, DB metadata) is treated as a
  prompt-injection vector and wrapped/flagged before any AI use.
- No telemetry; local-only analysis by default.

See [`docs/threat-model.md`](docs/threat-model.md) for the full model.

## Supported versions

The latest minor release receives security fixes during the research-preview
period.
