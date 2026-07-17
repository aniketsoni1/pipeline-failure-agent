# Sample scenarios

Each scenario is runnable with the `pipeline-agent` CLI (from the repo root). Local
scenarios use log files / dbt artifacts; platform scenarios use recorded fixtures
baked into the connectors (offline, no credentials required).

| # | Scenario | Command |
| --- | --- | --- |
| 1 | Python pipeline fails after a column rename | `npm run cli -- investigate samples/python-column-rename/logs/run.log` |
| 2 | GitHub Actions fails — missing repository secret | `npm run cli -- investigate --platform github --run-id 848271 --baseline 847900` |
| 3 | dbt model fails — type mismatch | `npm run cli -- investigate --platform dbt --run-id samples/dbt-type-mismatch/target` |
| 4 | Databricks task fails — schema drift / runtime | `npm run cli -- investigate --platform databricks --run-id 551 --baseline 540` |
| 5 | Snowflake query fails — upstream table change | `npm run cli -- investigate --platform snowflake --run-id 01af-fail --baseline 01ae-ok` |
| 6 | MongoDB aggregation slow — missing index | `npm run cli -- investigate --platform mongodb --run-id op_9f` |
| 7 | Jira historical-incident match | `npm run cli -- jira similar-incidents --about "silver transform customer_region schema drift"` |
| 8 | Succeeds locally, fails in CI — dependency drift | `npm run cli -- investigate samples/ci-dependency-drift/logs/run.log` |
| 9 | Databricks — Unity Catalog permission change | craft a run fixture with a `PERMISSION_DENIED` driver log (see connector fixtures) |
| 10 | Snowflake — unexpected row-count reduction | craft a query fixture with `rows_produced` anomaly + baseline (see connector fixtures) |

Scenarios 1–8 run out of the box. Scenarios 9–10 illustrate categories the rule
engine already classifies (`governance.permission`, `data.unexpected_rowcount`); add
a fixture to the corresponding connector to see them end-to-end.

Try different outputs:

```bash
npm run cli -- investigate --platform databricks --run-id 551 --baseline 540 -f markdown -o incident.md
npm run cli -- investigate --platform github --run-id 848271 -f json --fail-on high
npm run cli -- investigate --platform snowflake --run-id 01af-fail -f sarif -o results.sarif
```
