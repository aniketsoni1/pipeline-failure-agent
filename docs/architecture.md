# Architecture

## Design goals

Pipeline Failure Agent is **deterministic-first**: the entire root-cause workflow
runs with no AI provider. AI is an optional layer that only *rewords and ranks*
what the deterministic engine already found. The CLI and the VS Code extension are
thin presentation adapters over one shared core — no investigation logic is
duplicated in either UI.

## Layered dependencies

```
apps/cli ─┐                          ┌─ apps/vscode-extension
          ├──────── @pfa/agent ──────┤        (thin UI adapters)
          │   (orchestration seam)   │
          ▼                          ▼
   @pfa/investigation-engine   @pfa/connectors ──► connector-* (local, github,
          │  (pure pipeline)        │               jira, dbt, snowflake,
          ▼                         ▼               databricks, mongodb)
   @pfa/rule-engine          @pfa/reporting
          │                         │
          └────────► @pfa/core ◄────┴──── @pfa/security, @pfa/configuration
                 (types, model, schemas)
```

Rules that keep the graph acyclic and testable:

- Connectors depend only on `@pfa/core` contracts (and `@pfa/connector-local`'s
  log parser for shared parsing). They never import the engine.
- `@pfa/investigation-engine` is **pure**: it takes normalized inputs and returns
  an `Investigation`. It never performs I/O and never imports a connector.
- `@pfa/agent` is the only place that iterates connectors to gather cross-platform
  evidence, then calls the pure engine. Both apps call `@pfa/agent`.

## Normalized data model (`@pfa/core/model.ts`)

Platform payloads are mapped into common entities: `Connection`, `Run`/`RunDetail`,
`Stage`/`Task` (as `failedStage`/`source`), `Query`/`Notebook`/`DbObject` (as
`sourceRef.locator`), `LogEvent` (info/warning/error/fatal), `ConfigSnapshot`,
`ChangeEvent`, `CodeRef`, `RootCauseHypothesis`, `Evidence`, `Recommendation`,
`Incident`, `ExternalIssue`. Every entity carries `sourceRef` and the untouched
`raw` payload, so normalization is lossless and auditable.

## Connector interface (`@pfa/core/connector.ts`)

A connector advertises a `capabilities` set and implements only the matching
methods (`getRun`, `listRuns`, `compareRuns`, `searchChanges`, `searchIssues`).
Partial connectors are first-class — the engine only calls what is advertised.
Every connector also declares its agent **tools** as `ToolDescriptor`s.

## Agent-tool permission model

Each tool declares: `name`, `description`, `input`/`output` (Zod), `access`
(`read`|`write`), `risk` (`low`|`medium`|`high`), `permissions`, `redaction`
policy, `timeoutMs`, `retries`, and `audit`. Read + low/medium-risk tools may run
automatically when the connection is authorized. **Write tools always require an
explicit approval** through the `ConnectorContext.approve` callback (a terminal
prompt in the CLI, a modal in the extension). The default context denies writes
and yields no secrets.

## Investigation workflow (`@pfa/investigation-engine/pipeline.ts`)

`collect → redact → segment(info/warn/error) → dedup cascades → earliest
meaningful failure → locate (code ref) → classify (signatures) → compare failed
vs. baseline → correlate change events → search similar incidents → rank
hypotheses with a transparent 0..1 score → attach evidence (confirmed / strong
correlation / inference / assumption / missing information) → recommend verify +
remediate → report`. Approval is requested only for issue creation / writes.

## How the CLI and extension share functionality

Both import `investigateRun` / `investigatePlatformRun` from `@pfa/agent`, provide
a `ConnectorContext` (readline vs. SecretStorage + modal), and render the same
`Investigation` object differently (ANSI terminal vs. webview). The VS Code build
bundles the shared packages via esbuild aliases so there is literally one code
path.

## Module resolution

The monorepo uses TypeScript path aliases `@pfa/* → packages/*/src`, resolved by
`tsx` (CLI dev/run), Vitest (tests), and esbuild (extension + CLI release bundle).
This keeps a clean package boundary without a per-package build step during
development. Release bundles are produced with esbuild.
