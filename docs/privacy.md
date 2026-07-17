# Privacy

## Principles

- **Local-only by default.** All analysis is deterministic and runs on your
  machine / runner. No data leaves the process unless you explicitly enable AI.
- **No telemetry.** The tool collects and transmits no usage analytics. The config
  schema pins `security.telemetry = false`.
- **Redaction before anything else.** Secrets and PII are masked at the point every
  connector ingests data — before analysis, storage, reporting, or AI.

## What is processed

| Data | Where it goes | Notes |
| --- | --- | --- |
| Log content | In-memory, redacted | Truncated at `security.maxLogChars` (default 200k). |
| Query text / DB metadata | In-memory, redacted | No raw business rows; MongoDB values excluded by default. |
| Credentials | Provider only | Never written to config, reports, logs, or history. |
| Reports you export | Where you save them | You control the destination. |
| AI context (if enabled) | Your configured provider | Redacted + injection-wrapped; you can preview, mask fields, and exclude files; approval required per request. |

## Retention & deletion

- Configurable retention (`security.retentionDays`, default 7) governs any cached
  diagnostic data.
- Cached diagnostic data lives under `~/.pfa/` (override with `PFA_HOME`). Delete
  that directory to purge all local state.
- No hidden caches: reports exist only where you write them.

## AI controls

Enable/disable per provider and model; require approval before requests; cap token
usage; mask named fields; exclude file globs; or disable remote AI entirely. With
AI disabled (the default) the product is fully functional.
