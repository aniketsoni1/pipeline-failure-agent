/**
 * Recorded GitHub Actions payloads (trimmed to the fields the connector uses).
 * Shapes mirror the real REST API so the normalizer is exercised against
 * authentic structures. A live transport would return the same shapes.
 */
export interface GhRun {
  id: number;
  name: string;
  head_branch: string;
  head_sha: string;
  status: string;
  conclusion: string | null;
  run_started_at: string;
  updated_at: string;
  html_url: string;
  path: string;
}

export interface GhJob {
  id: number;
  run_id: number;
  name: string;
  conclusion: string | null;
  steps: { name: string; conclusion: string | null; number: number }[];
}

export interface GhCommit {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
  html_url: string;
}

export const RUNS: GhRun[] = [
  {
    id: 848271,
    name: 'data-pipeline',
    head_branch: 'main',
    head_sha: 'a1b2c3d',
    status: 'completed',
    conclusion: 'failure',
    run_started_at: '2026-07-15T08:00:00Z',
    updated_at: '2026-07-15T08:03:12Z',
    html_url: 'https://github.com/acme/data/actions/runs/848271',
    path: '.github/workflows/data-pipeline.yml',
  },
  {
    id: 847900,
    name: 'data-pipeline',
    head_branch: 'main',
    head_sha: 'f0e9d8c',
    status: 'completed',
    conclusion: 'success',
    run_started_at: '2026-07-14T08:00:00Z',
    updated_at: '2026-07-14T08:02:40Z',
    html_url: 'https://github.com/acme/data/actions/runs/847900',
    path: '.github/workflows/data-pipeline.yml',
  },
];

export const JOBS: Record<number, GhJob[]> = {
  848271: [
    {
      id: 1,
      run_id: 848271,
      name: 'build-and-load',
      conclusion: 'failure',
      steps: [
        { name: 'Checkout', conclusion: 'success', number: 1 },
        { name: 'Set up Python', conclusion: 'success', number: 2 },
        { name: 'Load to Snowflake', conclusion: 'failure', number: 3 },
      ],
    },
  ],
  847900: [
    {
      id: 2,
      run_id: 847900,
      name: 'build-and-load',
      conclusion: 'success',
      steps: [
        { name: 'Checkout', conclusion: 'success', number: 1 },
        { name: 'Set up Python', conclusion: 'success', number: 2 },
        { name: 'Load to Snowflake', conclusion: 'success', number: 3 },
      ],
    },
  ],
};

/** Raw step logs, keyed by run id. Includes a deliberately leaked token to
 * prove redaction runs at ingest. */
export const LOGS: Record<number, string> = {
  848271: `2026-07-15T08:00:01Z ##[group]Run Load to Snowflake
2026-07-15T08:00:02Z INFO Authenticating to Snowflake
2026-07-15T08:00:02Z DEBUG using token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345
2026-07-15T08:00:03Z Error: Input required and not supplied: SNOWFLAKE_PASSWORD
2026-07-15T08:00:03Z ##[error]Process completed with exit code 1.`,
  847900: `2026-07-14T08:00:01Z ##[group]Run Load to Snowflake
2026-07-14T08:00:02Z INFO Authenticating to Snowflake
2026-07-14T08:00:05Z INFO Loaded 12,400 rows
2026-07-14T08:00:06Z ##[endgroup]`,
};

export const COMMITS: GhCommit[] = [
  {
    sha: 'a1b2c3d',
    commit: {
      message: 'ci: migrate secrets to environment "prod" (rename SNOWFLAKE_PASSWORD)',
      author: { name: 'dev', date: '2026-07-15T07:45:00Z' },
    },
    html_url: 'https://github.com/acme/data/commit/a1b2c3d',
  },
];
