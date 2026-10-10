import { describe, expect, it } from 'vitest';
import type { AiRunRecord } from '../dependencies.ts';
import { createRunLog, estimateTokens } from './usage.ts';

const resolved = {
  ref: { providerId: 'p', providerName: 'Test provider', modelId: 'm' },
  // $10 in and $30 out per million tokens.
  capabilities: { cost: { input: 10, output: 30 } } as never,
};

function logFor(input: { prompt?: string; system?: string }) {
  const runs: AiRunRecord[] = [];
  const log = createRunLog(
    { record: async (run) => (runs.push(run), 'run') },
    { role: 'standard', purpose: 'answer', ...input },
    resolved,
  );
  return { log, runs };
}

function aborted(): { signal: AbortSignal; error: Error } {
  const controller = new AbortController();
  controller.abort();
  return { signal: controller.signal, error: new DOMException('aborted', 'AbortError') };
}

describe('the run log for a call that did not finish', () => {
  it('estimates tokens at about four characters each', () => {
    expect(estimateTokens(0)).toBe(0);
    expect(estimateTokens(4)).toBe(1);
    expect(estimateTokens(10)).toBe(3);
  });

  it('charges a cancelled stream for its prompt and the text already streamed', async () => {
    const { log, runs } = logFor({ system: 's'.repeat(400), prompt: 'p'.repeat(3600) });
    const { signal, error } = aborted();
    await log.failure(error, signal, false, 8000);
    expect(runs[0]).toMatchObject({ outcome: 'cancelled', inputTokens: 1000, outputTokens: 2000 });
    expect(runs[0]?.costUsd).toBeCloseTo((1000 * 10 + 2000 * 30) / 1e6, 6);
  });

  it('charges a timed-out call for its prompt', async () => {
    const { log, runs } = logFor({ prompt: 'p'.repeat(400) });
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    await log.failure(timeout, undefined, false);
    expect(runs[0]).toMatchObject({ outcome: 'timeout', inputTokens: 100, outputTokens: 0 });
    expect(runs[0]?.costUsd).toBeGreaterThan(0);
  });

  it('charges nothing for a call the provider refused', async () => {
    const { log, runs } = logFor({ prompt: 'p'.repeat(400) });
    const refused = Object.assign(new Error('Unauthorized'), { statusCode: 401 });
    await log.failure(refused, undefined, false, 0);
    expect(runs[0]).toMatchObject({ inputTokens: 0, outputTokens: 0, costUsd: 0 });
  });
});
