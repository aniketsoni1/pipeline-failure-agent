# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.2] - 2026-08-03 — VS Code extension

Metadata-only patch release of the VS Code extension. No functional changes to
the investigation engine, connectors or reporting — the extension code is
unchanged from 0.1.1. The shared core and CLI are unaffected.

### Changed

- `homepage` now points at
  <https://aniketsoni.com/extensions/pipeline-failure-agent/>, a dedicated
  documentation page, rather than the GitHub README anchor.
- Marketplace publishing in CI now prefers Entra ID workload identity
  federation (`vsce publish --azure-credential`) over a Personal Access
  Token. Global Azure DevOps PATs are retired on 2026-12-01; the PAT path
  remains as a fallback until then and emits a build warning.

### Added

- `qna` pointing at <https://aniketsoni.com/extensions/support/>, which
  collects the issue tracker, reporting guidance and the security disclosure
  process in one place.
- `sponsor` link, for parity with the other extensions published under this
  publisher.

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
