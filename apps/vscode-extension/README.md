# Pipeline Failure Agent — VS Code Extension

A dedicated **Pipeline Failure Agent** activity-bar view that investigates failed
pipelines, jobs, queries and workflows using the **same shared core** as the
`pipeline-agent` CLI (`@pfa/agent`, `@pfa/investigation-engine`, connectors,
security, reporting). No investigation logic is duplicated here.

## Features

- **Connections** and **Recent Failures** tree views in the activity bar.
- Investigate the active `.log` file, or a platform run by id.
- Root-cause hypotheses with transparent confidence rendered in a webview.
- Export a Markdown incident report.
- Create a Jira issue from a report — **only after an explicit approval modal**.
- Secret/PII redaction runs before any analysis; AI is off by default.

## Build

```bash
# from the monorepo root: install workspace deps first
npm install
cd apps/vscode-extension
npm install
npm run build      # bundles src + shared core via esbuild
```

Press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

Credentials use VS Code **SecretStorage**; nothing is written to settings or logs.
