# Contributing

Thanks for helping improve Pipeline Failure Agent.

## Getting started

```bash
npm install
npm run typecheck
npm test
npm run cli -- investigate samples/python-column-rename/logs/run.log
```

## Project layout

- `packages/core` — normalized model, schemas, Result, connector + tool contracts.
- `packages/security` — redaction, prompt-injection defense, audit.
- `packages/rule-engine` — signatures, classifier, dedup, earliest-failure, diff.
- `packages/investigation-engine` — the pure 19-step pipeline + knowledge packs.
- `packages/connector-*` — one package per platform; `packages/connectors` is the
  registry.
- `packages/agent` — cross-platform orchestration shared by both apps.
- `apps/cli`, `apps/vscode-extension` — thin UIs.

## Adding a failure signature

Add an entry to `packages/rule-engine/src/signatures.ts` (regex + category +
weight + title, optional `extract`) and a case to `rule-engine.test.ts`.

## Adding a connector

Implement the `Connector` interface in `packages/connector-<name>/src/index.ts`,
advertise `capabilities`, declare `tools()` with correct `access`/`risk`, register
it in `packages/connectors/src/index.ts`, and add recorded fixtures + a contract
test. Redact at ingest. Reads may auto-run; writes must call `ctx.approve`.

## Standards

- TypeScript strict; run `npm run typecheck` and `npm test` before pushing.
- Keep dependencies minimal and well-maintained.
- Never commit secrets or real customer data (fixtures must be synthetic).
- Conventional-ish commit messages appreciated.
