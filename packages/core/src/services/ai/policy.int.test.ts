import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startAiFixture, type AiFixture } from './ai-fixture.ts';
import { aiAdmin } from './index.ts';

describe('AI policy, budget, prompts and "none" against a real database', () => {
  let fx: AiFixture | undefined;
  let skip = '';
  let recording = '';

  beforeAll(async () => {
    const started = await startAiFixture();
    if ('skip' in started) skip = started.skip;
    else fx = started;
    const dir = await mkdtemp(join(tmpdir(), 'bemmoly-recording-'));
    recording = join(dir, 'recording.json');
    await writeFile(
      recording,
      JSON.stringify({ replies: { 'ai.fixture_summary': [{ text: 'Two blockers remain.' }] } }),
    );
  });
  afterAll(async () => fx?.close());

  it('refuses every AI call and endpoint cleanly while AI is "none"', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build({ recordingPath: recording });
    const off = { details: { reason: 'ai_off' } };
    await expect(
      ai.facade.generate({ role: 'fast', purpose: 'qa', prompt: 'x' }),
    ).rejects.toMatchObject(off);
    await expect(ai.facade.embed({ purpose: 'embed', values: ['x'] })).rejects.toMatchObject(off);
    await expect(aiAdmin.assertAiOn(ai.facade, fx.member)).rejects.toMatchObject(off);
    expect(await aiAdmin.getAiStatus(ai.facade, fx.member)).toMatchObject({
      enabled: false,
      availableRoles: [],
    });
    // Settings › AI stays reachable, so an admin can turn it on.
    const on = await aiAdmin.updateAiSettings(ai.context, fx.admin, { privacy: { enabled: true } });
    expect(on.privacy.enabled).toBe(true);
    expect(fx.events.at(-1)).toMatchObject({
      kind: 'ai.settings.changed',
      payload: { reasons: ['enabled'] },
    });
    expect(await aiAdmin.getAiStatus(ai.facade, fx.member)).toMatchObject({ enabled: true });
  });

  it('logs every call to ai_runs with the prompt version, and takes feedback from its owner', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build({ recordingPath: recording });
    await ai.load();
    const rendered = await ai.facade.renderPrompt('ai.fixture_summary', { title: 'PLT-204' });
    expect(rendered.prompt).toBe('Summarise PLT-204.');
    const result = await ai.facade.generate({ ...rendered, purpose: 'summary', actor: fx.member });
    expect(result.text).toBe('Two blockers remain.');
    const [run] = await fx.sql<
      { purpose: string; prompt_id: string; prompt_version: number; user_id: string }[]
    >`
      select purpose, prompt_id, prompt_version, user_id from ai_runs where id = ${result.runId}`;
    expect(run).toEqual({
      purpose: 'summary',
      prompt_id: 'ai.fixture_summary',
      prompt_version: 1,
      user_id: fx.member.id,
    });
    await aiAdmin.setAiRunFeedback(ai.context, fx.member, result.runId, 'not_useful');
    await expect(
      aiAdmin.setAiRunFeedback(ai.context, fx.admin, result.runId, 'useful'),
    ).rejects.toMatchObject({
      name: 'NotFoundError',
    });
    const usage = await aiAdmin.getAiUsage(ai.context, fx.admin, {});
    expect(usage.feedback).toEqual({ useful: 0, not_useful: 1 });
    expect(usage.byPurpose.map((bucket) => bucket.key)).toContain('summary');
  });

  it('accounts the monthly budget from ai_runs: warning at 80%, standard and strong paused at 100%', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build({ recordingPath: recording });
    await aiAdmin.updateAiSettings(ai.context, fx.admin, { budget: { monthlyBudgetUsd: 10 } });
    const spend = (usd: number) => fx!.sql`
      insert into ai_runs (role, purpose, input_hash, cost_usd, outcome)
      values ('standard', 'summary', 'h', ${usd}, 'ok')`;
    await spend(8.5);
    expect((await aiAdmin.getAiUsage(ai.context, fx.admin, {})).budget).toMatchObject({
      state: 'warning',
      budgetUsd: 10,
      pausedRoles: [],
    });
    await spend(2);
    ai.context.policy.invalidate();
    const usage = await aiAdmin.getAiUsage(ai.context, fx.admin, {});
    expect(usage.budget).toMatchObject({ state: 'paused', pausedRoles: ['standard', 'strong'] });
    expect(usage.totals.costUsd).toBeGreaterThanOrEqual(10.5);
    await expect(
      ai.facade.generate({ role: 'strong', purpose: 'plan', prompt: 'x' }),
    ).rejects.toMatchObject({
      details: { reason: 'budget_reached', role: 'strong' },
    });
    await expect(
      ai.facade.generate({ role: 'fast', purpose: 'qa', prompt: 'x' }),
    ).resolves.toBeTruthy();
    const roles = await aiAdmin.getAiStatus(ai.facade, fx.member);
    expect(roles.availableRoles).toEqual(['fast', 'embedding']);
    // Last month's spend does not count.
    const lastMonth = await aiAdmin.getAiUsage(ai.context, fx.admin, { month: '2026-01' });
    expect(lastMonth.budget).toMatchObject({ spentUsd: 0, state: 'ok' });
    await aiAdmin.updateAiSettings(ai.context, fx.admin, { budget: { monthlyBudgetUsd: null } });
  });

  it('overrides a prompt, diffs it against the repository and resets it', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build();
    await ai.load();
    const template = '# System\n\nBe very brief.\n\n# Prompt\n\nSummarise {{title}} in one line.';
    const overridden = await aiAdmin.overrideAiPrompt(
      ai.context,
      fx.admin,
      'ai.fixture_summary',
      template,
    );
    expect(overridden.override).toMatchObject({ template, updatedBy: fx.admin.id });
    const rendered = await ai.facade.renderPrompt('ai.fixture_summary', { title: 'PLT-9' });
    expect(rendered).toMatchObject({
      system: 'Be very brief.',
      prompt: 'Summarise PLT-9 in one line.',
    });
    const diff = await aiAdmin.diffAiPrompt(ai.context, fx.admin, 'ai.fixture_summary');
    expect(diff.lines).toContainEqual({ kind: 'added', text: 'Be very brief.' });
    expect(diff.lines).toContainEqual({ kind: 'removed', text: 'Be brief.' });
    await expect(
      aiAdmin.overrideAiPrompt(ai.context, fx.admin, 'ai.fixture_summary', '# Prompt\n\n{{other}}'),
    ).rejects.toMatchObject({ name: 'ValidationError' });
    await aiAdmin.resetAiPrompt(ai.context, fx.admin, 'ai.fixture_summary');
    expect((await ai.facade.renderPrompt('ai.fixture_summary', { title: 'PLT-9' })).prompt).toBe(
      'Summarise PLT-9.',
    );
  });

  it('lets a person opt out only when the admin allows it, and hides AI for them', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build({ recordingPath: recording });
    await expect(
      aiAdmin.setAiPreferences(ai.context, ai.facade, fx.member, { optedOut: true }),
    ).rejects.toMatchObject({
      name: 'ForbiddenError',
    });
    await aiAdmin.updateAiSettings(ai.context, fx.admin, {
      privacy: { perUserOptOutAllowed: true },
    });
    const status = await aiAdmin.setAiPreferences(ai.context, ai.facade, fx.member, {
      optedOut: true,
    });
    expect(status).toMatchObject({ enabled: false, optedOut: true, availableRoles: [] });
    await expect(
      ai.facade.generate({ role: 'fast', purpose: 'qa', prompt: 'x', actor: fx.member }),
    ).rejects.toMatchObject({ details: { reason: 'opted_out' } });
    expect(await ai.facade.maySend({ authorId: fx.member.id })).toBe(false);
    expect(await ai.facade.enabled(fx.admin)).toBe(true);
    await aiAdmin.setAiPreferences(ai.context, ai.facade, fx.member, { optedOut: false });
  });
});
