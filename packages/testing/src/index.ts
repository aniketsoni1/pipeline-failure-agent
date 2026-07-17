import type { LogEvent, RunDetail } from '@pfa/core';
import type { AiProvider } from '@pfa/ai-engine';

/** Shared test helpers + fakes so connectors and the engine test consistently. */

export function logEvent(seq: number, severity: LogEvent['severity'], message: string): LogEvent {
  return { seq, severity, message, redacted: false };
}

export function makeRun(partial: Partial<RunDetail> = {}): RunDetail {
  return {
    id: 'run-test',
    platform: 'local',
    pipeline: 'Test pipeline',
    status: 'failed',
    sourceRef: { platform: 'local', nativeId: 'run-test' },
    logs: [logEvent(0, 'error', "KeyError: 'region'")],
    ...partial,
  };
}

/** A deterministic fake AI provider that echoes a canned summary. */
export function fakeAiProvider(text = 'AI summary (fake).'): AiProvider {
  return {
    id: 'fake',
    async complete() {
      return { text, usage: { inputTokens: 10, outputTokens: 5 } };
    },
  };
}
