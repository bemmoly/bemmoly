import type { AiLanguageRole, AiModelCapabilities } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { aiRefusal } from '../refusals.ts';
import { createTestAi } from '../test-ai.ts';
import { estimateCallUsd, reserveBudget, UNCAPPED_OUTPUT_TOKENS } from './budget.ts';
import type { AiBudgetGuard, AiBudgetRequest } from './dependencies.ts';
import { createAiFacade } from './facade.ts';
import { createMockLanguageModel, mockLanguage, type MockReply } from './mock-models.ts';
import { createStaticModelSource } from './registry.ts';

// $10 in and $30 out per million tokens.
const priced = { cost: { input: 10, output: 30, cacheRead: null, cacheWrite: null } };
const capabilities = (extra: Partial<AiModelCapabilities> = {}) =>
  ({ ...priced, maxOutput: null, ...extra }) as AiModelCapabilities;

describe('estimating a call before it runs', () => {
  it('prices input from its characters and output at its cap', () => {
    const usd = estimateCallUsd(
      capabilities(),
      { system: 's'.repeat(400), prompt: 'p'.repeat(3600) },
      500,
    );
    expect(usd).toBeCloseTo((1000 * 10 + 500 * 30) / 1e6, 6);
  });

  it('assumes a bounded output when nothing caps it, or the model limit when lower', () => {
    expect(estimateCallUsd(capabilities(), { prompt: '' }, null)).toBeCloseTo(
      (UNCAPPED_OUTPUT_TOKENS * 30) / 1e6,
      6,
    );
    expect(estimateCallUsd(capabilities({ maxOutput: 1000 }), { prompt: '' }, null)).toBeCloseTo(
      (1000 * 30) / 1e6,
      6,
    );
  });

  it('counts every step of a tool loop', () => {
    const one = estimateCallUsd(capabilities(), { prompt: 'p'.repeat(400) }, 100);
    expect(
      estimateCallUsd(capabilities(), { prompt: 'p'.repeat(400), maxSteps: 3 }, 100),
    ).toBeCloseTo(one * 3, 6);
  });

  it('estimates 0 for a model without prices', () => {
    expect(estimateCallUsd(null, { prompt: 'x'.repeat(4000) }, 1000)).toBe(0);
    expect(estimateCallUsd({ cost: null } as never, { prompt: 'x' }, 10)).toBe(0);
  });
});

function fakeGuard(refuse = false) {
  const held = new Set<number>();
  const requests: AiBudgetRequest[] = [];
  let next = 0;
  const guard: AiBudgetGuard = {
    async reserve(request) {
      requests.push(request);
      if (refuse) throw aiRefusal('budget_reached', request.role);
      const id = next++;
      held.add(id);
      return { release: async () => void held.delete(id) };
    },
  };
  return { guard, held, requests };
}

function facadeWith(guard: AiBudgetGuard, reply: () => MockReply) {
  const calls: { prompt: unknown }[] = [];
  const language = (role: AiLanguageRole) => ({
    ...mockLanguage(createMockLanguageModel({ next: reply, calls, modelId: role })),
    capabilities: capabilities(),
  });
  return createAiFacade({
    models: createStaticModelSource({
      language: { fast: language('fast'), standard: language('standard') },
    }),
    // The test fake's policy: AI on, every role available.
    policy: { policy: () => createTestAi().policy() },
    runs: { record: async () => 'run' },
    prompts: { render: async () => Promise.reject(new Error('no prompts')) },
    budget: guard,
    maxRetries: 0,
  });
}

describe('the facade and the budget guard', () => {
  it('holds budget for a standard call while it runs and releases it after', async () => {
    const { guard, held, requests } = fakeGuard();
    const ai = facadeWith(guard, () => ({ text: 'ok' }));
    await ai.generate({
      role: 'standard',
      purpose: 'qa',
      prompt: 'x'.repeat(40),
      maxOutputTokens: 10,
    });
    expect(requests).toEqual([
      { role: 'standard', estimateUsd: (10 * 10 + 10 * 30) / 1e6, ttlMs: 2 * 60_000 + 60_000 },
    ]);
    expect(held.size).toBe(0);
  });

  it('releases the hold when the call fails, and when a stream settles', async () => {
    const { guard, held } = fakeGuard();
    const failing = facadeWith(guard, () => ({ error: new Error('provider down') }));
    await expect(
      failing.generate({ role: 'standard', purpose: 'qa', prompt: 'x' }),
    ).rejects.toThrow();
    expect(held.size).toBe(0);
    const streaming = facadeWith(guard, () => ({ text: 'a streamed answer' }));
    const stream = await streaming.stream({ role: 'standard', purpose: 'qa', prompt: 'x' });
    expect(held.size).toBe(1);
    for await (const chunk of stream.textStream) void chunk;
    await stream.result;
    expect(held.size).toBe(0);
  });

  it('refuses before the model is called, and never holds for roles the budget does not pause', async () => {
    const refused = fakeGuard(true);
    const ai = facadeWith(refused.guard, () => ({ text: 'ok' }));
    await expect(
      ai.generate({ role: 'standard', purpose: 'qa', prompt: 'x' }),
    ).rejects.toMatchObject({
      details: { reason: 'budget_reached', role: 'standard' },
    });
    await expect(ai.generate({ role: 'fast', purpose: 'qa', prompt: 'x' })).resolves.toBeTruthy();
    expect(refused.requests.map((request) => request.role)).toEqual(['standard']);
    expect(await reserveBudget(undefined, 'strong', 1, 1000)).toBeNull();
  });
});
