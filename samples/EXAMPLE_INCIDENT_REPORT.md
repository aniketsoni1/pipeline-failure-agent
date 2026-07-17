# Incident Report: Customer Revenue Pipeline: Spark cannot resolve column: customer_region

> Generated 2026-07-17T12:19:15.786Z · Investigation `0eghi3f`

## Summary

Customer Revenue Pipeline failed with probable cause: Spark cannot resolve column: customer_region. The earliest meaningful error was: 2026-07-15T08:00:12Z ERROR AnalysisException: cannot resolve `customer_region` given input columns: [region_code, id]

## Overview

| Field | Value |
| --- | --- |
| Pipeline | Customer Revenue Pipeline |
| Primary platform | databricks |
| Failed stage | silver_transform |
| Category | `schema.missing_column` |
| Confidence | high |
| Status | completed |

## Root-cause hypotheses

### 1. Spark cannot resolve column: customer_region
- **Category:** `schema.missing_column`
- **Confidence:** high (score 0.843)
- **Rationale:** The earliest meaningful failure matches the Missing column pattern; later log lines are downstream effects.
**Evidence**
- **✓ Confirmed** — Earliest meaningful error (line 0): 2026-07-15T08:00:12Z ERROR AnalysisException: cannot resolve `customer_region` given input columns: [region_code, id]
- **≈ Strong correlation** — schema_change "ALTER TABLE raw.customers RENAME COLUMN customer_region TO region_code" references "customer_region" and predates the failed run.
- **~ Inference** — Similar prior incident DATA-184: "Silver transform fails after customer_region column renamed" (similarity 15%). ([source](https://acme.atlassian.net/browse/DATA-184))
**Verify**

- [ ] Confirm the referenced column exists in the current source schema (INFORMATION_SCHEMA / DESCRIBE).
- [ ] Check recent schema changes or upstream PRs that renamed or dropped the column.
**Remediate**

- [ ] Update the transformation to the new column name, or add a temporary backward-compatible alias.
- [ ] Add a schema/data-contract test so the rename is caught before deploy.

## Failed vs. successful run

**New errors not present in the baseline**

- 2026-07-15T08:00:12Z ERROR AnalysisException: cannot resolve `customer_region` given input columns: [region_code, id]
- 2026-07-15T08:00:12Z ERROR Task silver_transform failed

## Related incidents

- [DATA-184](https://acme.atlassian.net/browse/DATA-184): Silver transform fails after customer_region column renamed — similarity 15%

## Evidence stream

The deduped, redacted error lines that drove this analysis:

```text
[0] 2026-07-15T08:00:12Z ERROR AnalysisException: cannot resolve `customer_region` given input columns: [region_code, id]
```

## Notes

- Collapsed 0 duplicate and 1 cascading error line(s).

---

_Evidence labels: **✓ Confirmed** (observed fact), **≈ Strong correlation**, **~ Inference**, **? Assumption**, **! Missing information**. Verify before acting on remediation steps._
