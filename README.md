# Pipeline Failure Agent

**Investigate failed data pipelines, jobs, queries and workflows — deterministically,
with optional AI.** One shared TypeScript core powers both a cross-platform CLI
(`pipeline-agent`) and a VS Code extension. It collects logs and metadata, redacts
secrets, isolates the *earliest meaningful* failure from cascading noise, classifies
it, compares against the last good run, correlates changes across platforms, matches
historical incidents, and produces a ranked, evidence-labeled incident report.

> Deterministic-first: the whole workflow runs with **no AI provider**. AI is an
> optional layer that only rewords and re-ranks what the rules already found.

## Why

When a pipeline breaks, the real cause is usually one early error buried under a
hundred downstream ones — and the "why" often lives in another system (a schema
change, a rotated secret, a dependency bump). This agent does that triage for you
and shows its work, labeling every claim as **confirmed**, **strong correlation**,
**inference**, **assumption**, or **missing information**.

## Quick start

```bash
npm install
npm run typecheck && npm test

# Investigate a local log file
npm run cli -- investigate samples/python-column-rename/logs/run.log

# Flagship cross-platform scenario (Databricks + Snowflake + Jira)
npm run cli -- investigate --platform databricks --run-id 551 --baseline 540
```

Example output:

```
  Customer Revenue Pipeline
  databricks · investigation 1hyqyrx · completed

  Probable root cause: Spark cannot resolve column: customer_region
  Category: schema.missing_column
  Confidence: high
  Failed stage: silver_transform

  1. Spark cannot resolve column: customer_region  [high 0.843]
     ✓ Earliest meaningful error: AnalysisException: cannot resolve `customer_region` ...
     ≈ schema_change "ALTER TABLE raw.customers RENAME COLUMN customer_region TO region_code" ...
     ~ Similar prior incident DATA-184: "Silver transform fails after customer_region column renamed"
     remediation:
       • Update the transformation to the new column name, or add a backward-compatible alias.
       • Add a schema/data-contract test so the rename is caught before deploy.
```

## CLI

```bash
pipeline-agent init | doctor | configure | connections list | plugins list | status

pipeline-agent investigate ./logs/pipeline.log
pipeline-agent investigate --platform github     --run-id 848271 --baseline 847900
pipeline-agent investigate --platform databricks --run-id 551 --baseline 540
pipeline-agent investigate --platform snowflake  --run-id 01af-fail
pipeline-agent investigate --platform mongodb    --run-id op_9f
pipeline-agent investigate --platform dbt        --run-id samples/dbt-type-mismatch/target

# CI / non-interactive
pipeline-agent investigate --platform github --run-id "$RUN_ID" \
  --format json --output investigation.json --fail-on high

# Jira
pipeline-agent jira issues search "project = DATA"
pipeline-agent jira similar-incidents --about "silver transform customer_region"
pipeline-agent jira issue create-from-report incident.md   # approval required
```

Output formats: `terminal`, `json`, `yaml`, `markdown`, `sarif`, `html`.

## VS Code extension

A dedicated **Pipeline Failure Agent** activity-bar view with **Connections** and
**Recent Failures** trees, active-log investigation, a webview report, Markdown
export, and approval-gated Jira issue creation. It imports the same `@pfa/agent`
core — no duplicated logic. See [`apps/vscode-extension`](apps/vscode-extension).

## Connectors (MVP)

| Platform | Status | Reads |
| --- | --- | --- |
| Local (Python/SQL/dbt logs) | ✅ working | log files + optional `*.meta.json` (baseline, deps, env) |
| dbt artifacts | ✅ working | `run_results.json` + `manifest.json` |
| GitHub Actions | 🎬 fixture-backed | runs, steps, logs, commits |
| Snowflake | 🎬 fixture-backed | query history/metadata, schema changes |
| Databricks | 🎬 fixture-backed | job runs, task states, driver logs, libraries |
| MongoDB | 🎬 fixture-backed | operation/explain metadata (values excluded) |
| Jira | 🎬 fixture-backed | issue search, similar-incident match, create-from-report |

Fixture-backed connectors expose a `Transport` seam — drop in a live REST/SDK
transport without touching the engine. Future connectors (Airflow, ADF, Glue, Step
Functions, Spark, Kafka, Fivetran, Dagster, Prefect, Fabric, Business Central, Azure
DevOps, ServiceNow, Slack, Teams) implement the same `Connector` interface.

## Security

Secret/PII redaction at every ingest boundary · connection-string masking ·
read-only defaults · explicit approval for writes · prompt-injection defense on all
untrusted content · redacted audit log · **no telemetry** · local-only analysis.
Credentials resolve through pluggable providers (env, OS keychain, VS Code
SecretStorage, **AWS Secrets Manager** governed by IAM) — never stored in config,
logs, or reports. See [`docs/threat-model.md`](docs/threat-model.md) and
[`docs/privacy.md`](docs/privacy.md).

## Repository layout

```
apps/            cli/  vscode-extension/
packages/        core  security  rule-engine  investigation-engine  reporting
                 configuration  agent  connectors  connector-{local,github,jira,
                 dbt,snowflake,databricks,mongodb}
samples/         runnable scenarios          docs/  architecture, threat-model, …
.github/         CI, security, release, templates
```

## Development

```bash
npm run typecheck     # tsc --noEmit across the workspace
npm test              # vitest (unit + contract + e2e)
npm run cli -- ...     # run the CLI via tsx
```

See [`docs/architecture.md`](docs/architecture.md) for the design,
[`CONTRIBUTING.md`](CONTRIBUTING.md) to add a signature or connector, and
[`docs/roadmap.md`](docs/roadmap.md) for what's next.

## License

Apache-2.0.
