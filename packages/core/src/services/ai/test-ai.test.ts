import { ForbiddenError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestAi } from './test-ai.ts';

const user = { kind: 'user' as const, id: '0199b1a2-7c3d-7e4f-8a5b-6c7d8e9f0a1b' };

describe('createTestAi', () => {
  it('answers text and records a run with the prompt ref', async () => {
    const ai = createTestAi({ replies: [{ text: 'Two blockers remain.' }] });
    const result = await ai.generate({
      role: 'standard',
      purpose: 'summary',
      prompt: 'Summarise PLT-204',
      actor: user,
      promptRef: { id: 'issue.summary', version: 3 },
    });
    expect(result.text).toBe('Two blockers remain.');
    expect(ai.runs).toHaveLength(1);
    expect(ai.runs[0]).toMatchObject({
      role: 'standard',
      purpose: 'summary',
      promptId: 'issue.summary',
      promptVersion: 3,
      outcome: 'ok',
      userId: user.id,
      inputTokens: 10,
      outputTokens: 5,
    });
    expect(result.runId).toMatch(/^0{8}-/);
  });

  it('validates structured output and repairs once', async () => {
    const ai = createTestAi({
      replies: [{ text: 'not json' }, { object: { title: 'Fix login', points: 3 } }],
    });
    const result = await ai.generate({
      role: 'fast',
      purpose: 'fill_field',
      prompt: 'Suggest',
      schema: z.object({ title: z.string(), points: z.number() }),
    });
    expect(result.object).toEqual({ title: 'Fix login', points: 3 });
    expect(result.outcome).toBe('repaired');
    expect(ai.calls).toHaveLength(2);
  });

  it('streams text deltas and settles the result', async () => {
    const ai = createTestAi({ replies: [{ text: 'one two three' }] });
    const stream = await ai.stream({ role: 'fast', purpose: 'autocomplete', prompt: 'Continue' });
    let text = '';
    for await (const delta of stream.textStream) text += delta;
    expect(text).toBe('one two three');
    expect((await stream.result).text).toBe('one two three');
  });

  it('embeds deterministically', async () => {
    const ai = createTestAi({ dimensions: 4 });
    const first = await ai.embed({ purpose: 'embed', values: ['a page'] });
    const second = await ai.embed({ purpose: 'embed', values: ['a page'] });
    expect(first.dimensions).toBe(4);
    expect(first.embeddings).toEqual(second.embeddings);
  });

  it('refuses cleanly when AI is off', async () => {
    const ai = createTestAi({ policy: { enabled: false } });
    await expect(ai.generate({ role: 'fast', purpose: 'qa', prompt: 'x' })).rejects.toMatchObject({
      details: { reason: 'ai_off' },
    });
    await expect(ai.enabled()).resolves.toBe(false);
    expect(ai.runs).toHaveLength(0);
  });

  it('pauses standard and strong at the budget, not fast', async () => {
    const ai = createTestAi({
      policy: { budgetState: 'paused', availableRoles: ['fast', 'embedding'] },
    });
    const refused = ai.generate({ role: 'strong', purpose: 'plan', prompt: 'x' });
    await expect(refused).rejects.toBeInstanceOf(ForbiddenError);
    await expect(refused).rejects.toMatchObject({ details: { reason: 'budget_reached' } });
    await expect(ai.generate({ role: 'fast', purpose: 'qa', prompt: 'x' })).resolves.toBeTruthy();
  });

  it('redacts emails before sending and restores them in the reply', async () => {
    const ai = createTestAi({ policy: { redactEmails: true } });
    ai.respond(() => ({ text: 'Ask [EMAIL_1] about it.' }));
    const result = await ai.generate({
      role: 'fast',
      purpose: 'qa',
      prompt: 'Who owns this? rohan@acme.test',
    });
    expect(JSON.stringify(ai.calls[0]?.prompt)).not.toContain('rohan@acme.test');
    expect(JSON.stringify(ai.calls[0]?.prompt)).toContain('[EMAIL_1]');
    expect(result.text).toBe('Ask rohan@acme.test about it.');
  });
});
