import type { FailureCategory } from '@pfa/core';

/**
 * Troubleshooting knowledge packs: per-category verification + remediation
 * guidance. Deterministic, human-reviewed, and platform-neutral. AI (when
 * enabled) only rewords these — it never invents remediation steps.
 */
export interface KnowledgePack {
  verify: string[];
  remediate: string[];
}

export const KNOWLEDGE: Partial<Record<FailureCategory, KnowledgePack>> = {
  'schema.missing_column': {
    verify: [
      'Confirm the referenced column exists in the current source schema (INFORMATION_SCHEMA / DESCRIBE).',
      'Check recent schema changes or upstream PRs that renamed or dropped the column.',
    ],
    remediate: [
      'Update the transformation to the new column name, or add a temporary backward-compatible alias.',
      'Add a schema/data-contract test so the rename is caught before deploy.',
    ],
  },
  'schema.type_mismatch': {
    verify: [
      'Inspect the source and target column types; identify where the cast fails.',
      'Check whether a recent load changed the incoming value format.',
    ],
    remediate: [
      'Add an explicit, safe cast (e.g. TRY_CAST) and route unparseable rows to a quarantine.',
      'Tighten the upstream data contract to reject the bad type earlier.',
    ],
  },
  'auth.secret_missing_or_expired': {
    verify: [
      'Confirm the named secret exists in the environment/repository and is in scope for this job.',
      'Check whether the secret expired or was rotated since the last successful run.',
    ],
    remediate: [
      'Add or restore the missing secret in the secret store used by this pipeline.',
      'Reference the secret through the credential broker; never inline it in config or logs.',
    ],
  },
  'deps.version_mismatch': {
    verify: [
      'Diff the resolved dependency versions between the failed and last successful run.',
      'Confirm the runtime image / interpreter version matches what the code expects.',
    ],
    remediate: [
      'Pin the offending dependency to a known-good version and lock the manifest.',
      'Align the CI runtime with local/production (same base image or runtime version).',
    ],
  },
  'deps.package_conflict': {
    verify: ['Confirm the missing/failing module is declared and installable in this environment.'],
    remediate: ['Add the package to the manifest and pin a compatible version.'],
  },
  'perf.missing_index': {
    verify: [
      'Run explain() and confirm a COLLSCAN / full scan on the hot query.',
      'Identify the predicate fields that should be indexed.',
    ],
    remediate: [
      'Create a compound index matching the query predicate and sort order.',
      'Re-run explain() to confirm the plan now uses the index.',
    ],
  },
  'governance.permission': {
    verify: [
      'Confirm the principal has the required privilege on the object (catalog/schema/table).',
      'Check for a recent grant/role change that removed access.',
    ],
    remediate: ['Restore the least-privilege grant needed for this job to read the object.'],
  },
  'sql.missing_object': {
    verify: ['Confirm the object exists and is visible to the executing role.'],
    remediate: ['Recreate or repoint to the correct object; verify the search path/schema.'],
  },
  'compute.out_of_memory': {
    verify: ['Check peak memory and spill metrics for the failed stage.'],
    remediate: [
      'Increase executor memory or reduce partition/skew; broadcast small joins.',
      'Filter or project earlier to cut shuffle volume.',
    ],
  },
  'network.timeout': {
    verify: ['Confirm the upstream endpoint is reachable and within latency budget.'],
    remediate: ['Add bounded retries with backoff; raise the timeout only if justified.'],
  },
  'data.unexpected_rowcount': {
    verify: [
      'Compare row counts across recent runs to locate where volume changed.',
      'Check for an upstream filter/join change or late-arriving data.',
    ],
    remediate: ['Add a row-count / freshness assertion so drift fails fast with a clear message.'],
  },
};

export const GENERIC_PACK: KnowledgePack = {
  verify: [
    'Reproduce with the failed run parameters and confirm the earliest error is the true cause.',
    'Compare against the last successful run to isolate what changed.',
  ],
  remediate: [
    'Address the earliest meaningful error first, then re-run to confirm downstream stages recover.',
  ],
};
