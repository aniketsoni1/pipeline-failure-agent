import type { FailureCategory, Platform, CodeRef } from '@pfa/core';

/**
 * Known error signatures. Each maps a text pattern to a failure category and,
 * where possible, extracts a code reference or a salient token (e.g. the missing
 * column name). Signatures are the deterministic backbone — no AI required.
 *
 * `weight` (0..1) expresses how strongly a match implies its category; it feeds
 * the transparent confidence score.
 */
export interface Signature {
  id: string;
  category: FailureCategory;
  /** Restrict to a platform, or leave undefined for cross-platform. */
  platform?: Platform;
  re: RegExp;
  weight: number;
  /** Short template; `$1` etc. reference capture groups. */
  title: string;
  extract?: (m: RegExpMatchArray) => { codeRef?: CodeRef; token?: string };
}

export const SIGNATURES: Signature[] = [
  // ---- Python ----
  {
    id: 'py.traceback',
    category: 'code.python_exception',
    re: /File "([^"]+)", line (\d+),/,
    weight: 0.5,
    title: 'Python traceback frame',
    extract: (m) => ({ codeRef: { path: m[1]!, line: Number(m[2]) } }),
  },
  {
    id: 'py.keyerror',
    category: 'schema.missing_column',
    re: /KeyError:\s*'([^']+)'/,
    weight: 0.85,
    title: 'Missing key/column: $1',
    extract: (m) => ({ token: m[1] }),
  },
  {
    id: 'py.pandas_missing_column',
    category: 'schema.missing_column',
    re: /(?:KeyError|ColumnNotFound).*?\['?([A-Za-z_][A-Za-z0-9_]*)'?\]|column ['"]?([A-Za-z_][A-Za-z0-9_]*)['"]? (?:not found|does not exist)/i,
    weight: 0.8,
    title: 'Referenced column not present: $1$2',
    extract: (m) => ({ token: m[1] ?? m[2] }),
  },
  {
    id: 'py.modulenotfound',
    category: 'deps.package_conflict',
    re: /ModuleNotFoundError:\s*No module named '([^']+)'/,
    weight: 0.9,
    title: 'Missing Python module: $1',
    extract: (m) => ({ token: m[1] }),
  },
  {
    id: 'py.typeerror',
    category: 'schema.type_mismatch',
    re: /TypeError:\s*(.+)/,
    weight: 0.55,
    title: 'Type error',
  },
  {
    id: 'py.filenotfound',
    category: 'fs.missing_file',
    re: /FileNotFoundError:.*?'([^']+)'/,
    weight: 0.85,
    title: 'File not found: $1',
    extract: (m) => ({ token: m[1] }),
  },
  {
    id: 'py.memoryerror',
    category: 'compute.out_of_memory',
    re: /MemoryError|Killed process|OutOfMemory/,
    weight: 0.8,
    title: 'Out of memory',
  },

  // ---- SQL / Snowflake ----
  {
    id: 'sql.invalid_identifier',
    category: 'schema.missing_column',
    re: /invalid identifier '([^']+)'/i,
    weight: 0.9,
    title: 'Invalid identifier: $1',
    extract: (m) => ({ token: m[1] }),
  },
  {
    id: 'sql.object_does_not_exist',
    category: 'sql.missing_object',
    re: /Object '([^']+)' does not exist|does not exist or not authorized/i,
    weight: 0.85,
    title: 'Missing database object: $1',
    extract: (m) => ({ token: m[1] }),
  },
  {
    id: 'sql.compilation',
    category: 'sql.syntax_or_compilation',
    re: /SQL compilation error|syntax error (?:at|near)/i,
    weight: 0.7,
    title: 'SQL compilation error',
  },
  {
    id: 'sql.numeric_conversion',
    category: 'schema.type_mismatch',
    re: /Numeric value '([^']*)' is not recognized|cannot be cast|Failed to cast/i,
    weight: 0.8,
    title: 'Type conversion failure',
  },
  {
    id: 'snowflake.warehouse_suspended',
    category: 'infra.warehouse_or_cluster',
    platform: 'snowflake',
    re: /Warehouse '([^']+)' .*(suspended|cannot be resumed)/i,
    weight: 0.8,
    title: 'Warehouse unavailable: $1',
    extract: (m) => ({ token: m[1] }),
  },

  // ---- dbt ----
  {
    id: 'dbt.type_mismatch',
    category: 'schema.type_mismatch',
    platform: 'dbt',
    re: /cannot be cast|does not match|incompatible types|type (?:mismatch|error)/i,
    weight: 0.75,
    title: 'dbt type mismatch',
  },
  {
    id: 'dbt.not_null',
    category: 'data.null_violation',
    platform: 'dbt',
    re: /not_null.*failed|null values? (?:in|for) column/i,
    weight: 0.8,
    title: 'dbt not_null test failure',
  },
  {
    id: 'dbt.unique',
    category: 'data.duplicate_records',
    platform: 'dbt',
    re: /unique.*(?:test )?failed|duplicate/i,
    weight: 0.75,
    title: 'dbt uniqueness failure',
  },

  // ---- Databricks / Spark ----
  {
    id: 'spark.analysis_missing_column',
    category: 'schema.missing_column',
    re: /AnalysisException:?\s*cannot resolve\s*['"`]?([A-Za-z0-9_.]+)['"`]?|Column '([^']+)' does not exist/i,
    weight: 0.9,
    title: 'Spark cannot resolve column: $1$2',
    extract: (m) => ({ token: m[1] ?? m[2] }),
  },
  {
    id: 'spark.oom',
    category: 'compute.out_of_memory',
    re: /java\.lang\.OutOfMemoryError|GC overhead limit exceeded|Container killed.*memory/i,
    weight: 0.85,
    title: 'Executor out of memory',
  },
  {
    id: 'databricks.library_install',
    category: 'deps.version_mismatch',
    platform: 'databricks',
    re: /Library installation failed|could not find a version that satisfies|incompatible.*runtime/i,
    weight: 0.8,
    title: 'Library installation / runtime incompatibility',
  },
  {
    id: 'databricks.unity_catalog_perm',
    category: 'governance.permission',
    platform: 'databricks',
    re: /does not have (?:permission|privilege)|PERMISSION_DENIED|Unauthorized access to (?:table|schema|catalog)/i,
    weight: 0.85,
    title: 'Unity Catalog permission denied',
  },
  {
    id: 'delta.write_conflict',
    category: 'data.referential_integrity',
    re: /ConcurrentAppendException|Delta.*conflict|commit failed.*concurrent/i,
    weight: 0.75,
    title: 'Delta write conflict',
  },

  // ---- MongoDB ----
  {
    id: 'mongo.no_index',
    category: 'perf.missing_index',
    platform: 'mongodb',
    re: /COLLSCAN|no index (?:available|found)|query targeting.*collection scan/i,
    weight: 0.8,
    title: 'Collection scan — missing index',
  },
  {
    id: 'mongo.duplicate_key',
    category: 'data.duplicate_records',
    platform: 'mongodb',
    re: /E11000 duplicate key error/i,
    weight: 0.85,
    title: 'Duplicate key error',
  },
  {
    id: 'mongo.auth',
    category: 'auth.authentication',
    platform: 'mongodb',
    re: /Authentication failed|not authorized on .* to execute/i,
    weight: 0.85,
    title: 'MongoDB authentication/authorization failure',
  },

  // ---- GitHub Actions / CI ----
  {
    id: 'gha.missing_secret',
    category: 'auth.secret_missing_or_expired',
    platform: 'github-actions',
    re: /Input required and not supplied: ([A-Za-z0-9_]+)|secret ([A-Za-z0-9_]+) (?:is )?not set|Context access might be invalid: ([A-Za-z0-9_]+)/i,
    weight: 0.85,
    title: 'Missing repository secret: $1$2$3',
    extract: (m) => ({ token: m[1] ?? m[2] ?? m[3] }),
  },
  {
    id: 'gha.bad_credentials',
    category: 'auth.authentication',
    re: /Bad credentials|401 Unauthorized|authentication token .*expired/i,
    weight: 0.8,
    title: 'Bad or expired credentials',
  },
  {
    id: 'ci.npm_version',
    category: 'deps.version_mismatch',
    re: /npm ERR!.*peer dep|ERESOLVE|version solving failed|Could not find a version that satisfies/i,
    weight: 0.8,
    title: 'Dependency version resolution failure',
  },
  {
    id: 'ci.test_failure',
    category: 'run.partial_execution',
    re: /(\d+) (?:tests? )?failed|FAILED \(failures=\d+\)|Tests failed/i,
    weight: 0.5,
    title: 'Test failures',
  },

  // ---- Generic network / auth / timeout ----
  {
    id: 'net.timeout',
    category: 'network.timeout',
    re: /(?:connection|read|request) timed out|ETIMEDOUT|deadline exceeded/i,
    weight: 0.7,
    title: 'Network timeout',
  },
  {
    id: 'net.connreset',
    category: 'network.connectivity',
    re: /ECONNREFUSED|ECONNRESET|Could not resolve host|getaddrinfo ENOTFOUND/i,
    weight: 0.75,
    title: 'Connectivity failure',
  },
  {
    id: 'net.ratelimit',
    category: 'network.rate_limit',
    re: /rate limit exceeded|429 Too Many Requests|API rate limit/i,
    weight: 0.8,
    title: 'Rate limit exceeded',
  },
  {
    id: 'auth.forbidden',
    category: 'auth.authorization',
    re: /403 Forbidden|permission denied|access denied|not authorized/i,
    weight: 0.65,
    title: 'Authorization failure',
  },
];
