# Pipeline Failure Agent

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/AniketSoni.pipeline-failure-agent-vscode?label=Marketplace&color=2563EB)](https://marketplace.visualstudio.com/items?itemName=AniketSoni.pipeline-failure-agent-vscode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/AniketSoni.pipeline-failure-agent-vscode?color=06B6D4)](https://marketplace.visualstudio.com/items?itemName=AniketSoni.pipeline-failure-agent-vscode)
[![Build](https://img.shields.io/github/actions/workflow/status/aniketsoni1/pipeline-failure-agent/ci.yml?branch=main&label=build)](https://github.com/aniketsoni1/pipeline-failure-agent/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/aniketsoni1/pipeline-failure-agent/blob/main/LICENSE)

Investigate failed data pipelines, jobs, queries and workflows **without leaving VS Code**. Point it at a failed run or a log file and it isolates the earliest meaningful failure from cascading noise, classifies it, compares the failed run against a healthy baseline, correlates root causes across platforms, and produces a ranked, **evidence-labeled** incident report — right inside an editor panel.

> **Deterministic-first and private by design.** All analysis runs locally, secrets and PII are redacted before anything is inspected, and there is **no telemetry**. AI assistance is entirely optional and **off by default** — the full investigation works without it.

The extension is a thin UI over the **same shared core** as the `pipeline-agent` CLI (`@pfa/agent`, `@pfa/investigation-engine`, connectors, security, reporting), so the two tools always agree — no investigation logic is duplicated here.

<!--
SCREENSHOTS — drop PNGs into apps/vscode-extension/media/screenshots/ and
uncomment the block in the "Screenshots" section near the bottom.
Recommended captures (1200–1600px wide, light or dark theme, consistent):
  1. report-webview.png  — the ranked hypotheses + confidence report panel
  2. activity-bar.png    — Connections + Recent Failures trees in the sidebar
  3. investigate-log.png — right-click a .log file → Investigate Active Log File
  4. jira-approval.png   — the approval modal before a Jira issue is created
-->

## Features

- **Root-cause report panel** — ranked hypotheses with a transparent `0..1` confidence score, rendered in an interactive webview.
- **Evidence labeling** — every finding is tagged `confirmed`, `strong_correlation`, `inference`, `assumption`, or `missing_information`, so you always know how much to trust it.
- **Earliest-failure isolation** — separates the first meaningful error from the cascade of downstream noise it triggers.
- **Failed-vs-baseline diff** — compares a failed run against a known-good run to surface what actually changed.
- **Cross-platform correlation** — connects failures across Databricks, Snowflake, dbt, GitHub, MongoDB and Jira to find a shared root cause.
- **Activity Bar panel** — **Connections** and **Recent Failures** tree views; click a failure to investigate it.
- **Investigate a log file** — run against the active `.log` editor, or right-click any `.log` file in the Explorer.
- **Investigate a run by id** — pick a platform and enter a run / query / operation id.
- **Markdown incident report** — export the full report to a `.md` file with one command.
- **Approval-gated Jira issues** — file an incident to Jira, but **only after an explicit confirmation** — no silent writes.
- **Secret / PII redaction** — deny-by-default redaction runs at every ingest boundary, before any analysis.
- **Optional AI** — off by default; when enabled it only summarizes/ranks and can never trigger a write.

## Getting Started

### 1. Install

Search **"Pipeline Failure Agent"** in the VS Code Extensions panel, or install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=AniketSoni.pipeline-failure-agent-vscode).

### 2. Open the panel

Click the **Pipeline Failure Agent** icon in the Activity Bar. You'll see two tree views: **Connections** (the platforms available to investigate) and **Recent Failures**.

### 3. Investigate a failure

Choose whichever fits what you have:

| You have… | Do this |
| --- | --- |
| A local log file | Open the `.log` file and run **Pipeline Agent: Investigate Active Log File** — or right-click the file in the Explorer. |
| A platform run | Run **Pipeline Agent: Investigate Run…**, pick the platform, and paste the run / query / operation id. |
| A failure in the sidebar | Click it in **Recent Failures** (hover → the inline investigate action). |

All actions are also in the Command Palette (<kbd>Cmd/Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> → type "Pipeline Agent").

### 4. Read the report

The report panel opens with the ranked root-cause hypotheses, each with its confidence score and labeled evidence. Where a baseline is available, the failed-vs-healthy diff is shown inline.

### 5. Export or file it

- **Pipeline Agent: Export Incident Report** writes the full report to a Markdown file.
- **Pipeline Agent: Create Jira Issue from Report** opens an approval modal first, then files the incident to Jira.

## Commands

| Command | Description |
| --- | --- |
| `Pipeline Agent: Investigate Active Log File` | Analyze the log in the active editor |
| `Pipeline Agent: Investigate Run…` | Analyze a platform run by id |
| `Pipeline Agent: Export Incident Report` | Save the last report as Markdown |
| `Pipeline Agent: Create Jira Issue from Report` | File the incident to Jira (approval-gated) |
| `Pipeline Agent: Refresh` | Re-scan connections and recent failures |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `pfa.redaction` | `strict` | Secret/PII redaction level applied before analysis (`strict` \| `standard` \| `none`). |
| `pfa.correlate` | `true` | Correlate change events and historical incidents across connectors. |
| `pfa.ai.enabled` | `false` | Enable optional AI-assisted explanation. Local analysis always runs regardless. |
| `pfa.ai.provider` | `""` | AI provider id (only used when `pfa.ai.enabled` is `true`). |

## Privacy

Analysis runs locally in your VS Code environment. Secrets and PII are redacted before any content is inspected, credentials are stored only in VS Code **SecretStorage** (never written to `settings.json` or logs), and the extension sends **no telemetry**. The only outbound calls are to the platforms you explicitly connect (e.g. Jira, when you approve an issue). AI is off unless you turn it on, and even then it can never initiate a write.

## Requirements

- VS Code **1.85** or later.
- A failed pipeline/job log file, or access to a supported platform run (Databricks, Snowflake, dbt, GitHub, MongoDB, Jira).
- *(Optional)* an AI provider, only if you enable `pfa.ai.enabled`.

## Contributing

Issues and pull requests are welcome at [github.com/aniketsoni1/pipeline-failure-agent](https://github.com/aniketsoni1/pipeline-failure-agent).

To run the extension from source:

```bash
# from the monorepo root: install workspace deps first
npm install
cd apps/vscode-extension
npm install
npm run build      # bundles src + shared core via esbuild
```

Then press <kbd>F5</kbd> in VS Code to launch an Extension Development Host.

## License

[Apache-2.0](https://github.com/aniketsoni1/pipeline-failure-agent/blob/main/LICENSE) — free to use, modify, and distribute.

## Screenshots

<!--
Uncomment once you've added images to media/screenshots/ (see note at top).

### Root-cause report
![Ranked hypotheses with confidence and labeled evidence](media/screenshots/report-webview.png)

### Activity Bar
![Connections and Recent Failures trees](media/screenshots/activity-bar.png)

### Investigate a log file
![Right-click a .log file to investigate it](media/screenshots/investigate-log.png)

### Approval-gated Jira issue
![Confirmation modal before a Jira issue is created](media/screenshots/jira-approval.png)
-->

_Screenshots coming soon._
