import { ProviderError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { budgetStatusOf } from '../../policy.ts';
import { createTestAi } from '../../test-ai.ts';
import { isRetryable, toProviderError } from '../errors.ts';
import { costOf } from '../gate.ts';
import { createRedaction } from './redaction.ts';

describe('budget thresholds', () => {
  it('is ok below 80%, warns from 80% and pauses standard and strong at 100%', () => {
    expect(budgetStatusOf(79.99, 100, '2026-10').state).toBe('ok');
    expect(budgetStatusOf(80, 100, '2026-10')).toMatchObject({ state: 'warning', pausedRoles: [] });
    expect(budgetStatusOf(100, 100, '2026-10')).toMatchObject({
      state: 'paused',
      ratio: 1,
      pausedRoles: ['standard', 'strong'],
    });
    expect(budgetStatusOf(5, null, '2026-10')).toMatchObject({ state: 'unlimited', ratio: null });
  });

  it('prices runs from the catalog, with cached input at the cache-read price', () => {
    const capabilities = {
      cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
    } as Parameters<typeof costOf>[0];
    expect(costOf(capabilities, { inputTokens: 1_000_000, outputTokens: 0 })).toBe(3);
    expect(
      costOf(capabilities, {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cachedInputTokens: 500_000,
      }),
    ).toBe(1.5 + 0.15 + 1.5);
    expect(costOf(null, { inputTokens: 10, outputTokens: 10 })).toBe(0);
  });

  it('refuses budget-paused roles before any model call, and records nothing', async () => {
    const ai = createTestAi({
      policy: { budgetState: 'paused', availableRoles: ['fast', 'embedding'] },
    });
    await expect(
      ai.generate({ role: 'standard', purpose: 'summary', prompt: 'x' }),
    ).rejects.toMatchObject({
      details: { reason: 'budget_reached', role: 'standard' },
    });
    expect(ai.calls).toHaveLength(0);
    expect(ai.runs).toHaveLength(0);
  });
});

describe('privacy redaction', () => {
  it('replaces emails and names with stable placeholders and restores them', () => {
    const redaction = createRedaction({ emails: true, names: ['Rohan Mehta', 'Ana'] });
    const sent = redaction.redact('Rohan Mehta (rohan@acme.test) asked Ana; cc rohan@acme.test');
    expect(sent).toBe('[PERSON_1] ([EMAIL_1]) asked [PERSON_2]; cc [EMAIL_1]');
    expect(redaction.restore('Reply to [PERSON_1] at [EMAIL_1].')).toBe(
      'Reply to Rohan Mehta at rohan@acme.test.',
    );
  });

  it('restores placeholders split across stream deltas', async () => {
    const ai = createTestAi({ policy: { redactEmails: true } });
    ai.respond(() => ({ text: 'Write to [EMAIL_1] today' }));
    const stream = await ai.stream({
      role: 'fast',
      purpose: 'autocomplete',
      prompt: 'Who? lee@acme.test',
    });
    let text = '';
    for await (const delta of stream.textStream) text += delta;
    expect(text).toBe('Write to lee@acme.test today');
    expect(JSON.stringify(ai.calls[0]?.prompt)).not.toContain('lee@acme.test');
  });

  it('restores names in structured output', async () => {
    const ai = createTestAi({ policy: { redactNames: true }, names: ['Priya Shah'] });
    ai.respond(() => ({ object: { owner: '[PERSON_1]' } }));
    const result = await ai.generate({
      role: 'fast',
      purpose: 'fill_field',
      prompt: 'Priya Shah owns the login epic',
      schema: z.object({ owner: z.string() }),
    });
    expect(result.object).toEqual({ owner: 'Priya Shah' });
  });
});

describe('structured-output repair', () => {
  it('fails with a typed invalid_output error after one repair attempt', async () => {
    const ai = createTestAi({ replies: [{ text: 'nope' }, { text: 'still nope' }] });
    const failed = ai.generate({
      role: 'fast',
      purpose: 'fill_field',
      prompt: 'x',
      schema: z.object({ title: z.string() }),
    });
    await expect(failed).rejects.toBeInstanceOf(ProviderError);
    await expect(failed).rejects.toMatchObject({ details: { failure: 'invalid_output' } });
    expect(ai.calls).toHaveLength(2);
    expect(ai.runs[0]?.outcome).toBe('invalid_output');
  });
});

describe('error normalisation', () => {
  const apiError = (statusCode: number, headers: Record<string, string> = {}, body?: string) =>
    Object.assign(new Error(`status ${statusCode}`), {
      name: 'AI_APICallError',
      statusCode,
      responseHeaders: headers,
      ...(body ? { responseBody: body } : {}),
    });

  it('says a rate limit in plain words with the retry delay', () => {
    const error = toProviderError(apiError(429, { 'retry-after': '30' }), 'Acme AI');
    expect(error.message).toBe("Acme AI returned a rate limit; I'll retry in 30 seconds");
    expect(error.details).toMatchObject({ failure: 'rate_limit', retryAfterSeconds: 30 });
  });

  it("keeps the provider's own message and never a key", () => {
    const error = toProviderError(
      apiError(
        401,
        {},
        JSON.stringify({ error: { message: 'Invalid key sk-abcdef1234567890XYZ' } }),
      ),
      'Acme AI',
    );
    expect(error.message).toMatch(/refused the credentials/);
    const details = error.details as { providerMessage: string };
    expect(details.providerMessage).toContain('Invalid key');
    expect(details.providerMessage).not.toContain('abcdef1234567890');
  });

  it('unwraps the retry wrapper and classifies timeouts and outages', () => {
    const wrapped = Object.assign(new Error('retries exhausted'), {
      name: 'AI_RetryError',
      lastError: apiError(503),
    });
    expect(toProviderError(wrapped, 'Acme AI').details).toMatchObject({ failure: 'unavailable' });
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    expect(toProviderError(timeout, 'Acme AI').message).toBe('Acme AI took too long to answer');
    expect(isRetryable(apiError(429))).toBe(true);
    expect(isRetryable(apiError(400))).toBe(false);
  });

  it('turns a failing provider into a ProviderError and logs the failed run', async () => {
    const ai = createTestAi({ replies: [{ error: apiError(500) }] });
    await expect(
      ai.generate({ role: 'standard', purpose: 'qa', prompt: 'x' }),
    ).rejects.toMatchObject({
      name: 'ProviderError',
      details: { failure: 'unavailable', provider: 'Test provider' },
    });
    expect(ai.runs[0]).toMatchObject({ outcome: 'error', costUsd: 0 });
  });
});
