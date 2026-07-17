import { describe, it, expect } from 'vitest';
import { parseLogText } from './parse.js';
import { runFromLogText } from './index.js';

const PY_LOG = `2024-05-01 10:00:00 INFO Starting silver_transformation
2024-05-01 10:00:01 INFO Loading customers
Traceback (most recent call last):
  File "/app/etl/silver.py", line 42, in transform
    df["customer_region"]
KeyError: 'customer_region'
2024-05-01 10:00:02 ERROR Job run failed`;

describe('local log parser', () => {
  it('assigns severities and extracts code refs', () => {
    const events = parseLogText(PY_LOG);
    const keyError = events.find((e) => e.message.includes('KeyError'));
    expect(keyError?.severity).toBe('error');
    expect(keyError?.code?.path).toBe('/app/etl/silver.py');
    expect(keyError?.code?.line).toBe(42);
    const info = events.find((e) => e.message.includes('Starting'));
    expect(info?.severity).toBe('info');
  });

  it('builds a RunDetail with metadata', () => {
    const run = runFromLogText(PY_LOG, {
      pipeline: 'Customer Revenue',
      failedStage: 'silver',
      dependencies: { pandas: '2.2.0' },
    });
    expect(run.pipeline).toBe('Customer Revenue');
    expect(run.configs?.[0]?.kind).toBe('dependencies');
    expect(run.logs.length).toBeGreaterThan(3);
  });
});
