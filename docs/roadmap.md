# Phased roadmap

## Phase 0 — MVP spine (this release)
- Shared core: model, schemas, security (redaction/injection/audit), rule engine,
  investigation engine, reporting (terminal/json/yaml/markdown/sarif/html).
- Connectors: local (Python/SQL/dbt logs, working), dbt artifacts (working),
  GitHub Actions / Jira / Snowflake / Databricks / MongoDB (fixture-backed with
  contract tests).
- `pipeline-agent` CLI + VS Code extension over one shared core.
- Deterministic classification, dedup, earliest-failure, failed-vs-baseline diff,
  cross-platform correlation, historical-incident matching.

## Phase 1 — Live connectors + depth
- Real transports for GitHub/Databricks/Snowflake/MongoDB/Jira behind the existing
  `Transport` seams; mock servers retained for tests.
- `github pr analyze`, `snowflake task history`, `databricks cluster diagnose`,
  `mongodb aggregation analyze` subcommands.
- Statistical anomaly detection for row-count/credit/latency regressions.

## Phase 2 — AI-assist + watch mode
- `@pfa/ai-engine` live: summarize evidence, rank ambiguous hypotheses, draft
  report wording — off by default, approval-gated, token-capped.
- Watch mode (analyze-only) for GitHub/Databricks/Snowflake.
- Code Actions in the extension (navigate stack trace → file; apply safe fixes).

## Phase 3 — Ecosystem
- Future connectors: Fabric, Airflow, ADF, Glue, Step Functions, Spark, Kafka,
  Fivetran, Dagster, Prefect, Business Central, Azure DevOps, ServiceNow, Slack,
  Teams — each via the same `Connector` interface + mock + contract tests.
- Release engineering: container image, Marketplace + Open VSX + npm publishing,
  platform-specific CLI binaries.
