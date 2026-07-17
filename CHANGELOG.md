# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-07-17
### Added
- Shared deterministic core: normalized model, Zod schemas, security (redaction,
  prompt-injection defense, audit), rule engine (signatures, classifier, dedup,
  earliest-failure, run comparison), investigation engine, reporting
  (terminal/json/yaml/markdown/sarif/html), configuration + credential providers.
- Connectors: local logs and dbt artifacts (working); GitHub Actions, Snowflake,
  Databricks, MongoDB, Jira (fixture-backed with contract tests).
- `pipeline-agent` CLI and VS Code extension over one shared `@pfa/agent` core.
- Cross-platform correlation and historical-incident matching.
- Optional, off-by-default AI-provider abstraction.
- Docs (architecture, threat model, privacy, troubleshooting, roadmap), CI /
  security / release workflows, Dockerfile, and issue/PR templates.

[Unreleased]: https://github.com/your-org/pipeline-failure-agent/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/pipeline-failure-agent/releases/tag/v0.1.0
