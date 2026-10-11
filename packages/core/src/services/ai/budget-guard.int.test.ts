import type { AiModelCapabilities } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AiFacade } from '../../contracts/ai.ts';
import { startAiFixture, type AiFixture } from './ai-fixture.ts';
import { createDbBudgetGuard } from './budget-guard.ts';
import { aiAdmin } from './index.ts';
import { createPolicySource } from './policy.ts';
import type { AiBudgetGuard } from './runtime/dependencies.ts';
import { createAiFacade } from './runtime/facade.ts';
import { createMockLanguageModel, mockLanguage, type MockCall } from './runtime/mock-models.ts';
import { createStaticModelSource } from './runtime/registry.ts';
import { insertRun } from './store/runs.ts';

// $1,000 per million tokens either way: a 400-character prompt capped at 100 output tokens
// estimates $0.20, and the mock's reported 10 in and 5 out cost $0.015.
const PRICED: AiModelCapabilities = {
  toolCall: true,
  structuredOutput: true,
  reasoning: false,
  attachment: false,
  temperature: true,
  contextWindow: 128_000,
  maxOutput: 4_096,
  inputModalities: ['text'],
  outputModalities: ['text'],
  cost: { input: 1_000, output: 1_000, cacheRead: null, cacheWrite: null },
  dimensions: null,
  status: null,
  releaseDate: null,
};
const CALL = { role: 'standard', purpose: 'budget-race', prompt: 'x'.repeat(400) } as const;

describe('the budget guard against a real database', () => {
  let fx: AiFixture | undefined;
  let skip = '';
  let facade: AiFacade;
  let guard: AiBudgetGuard;
  const calls: MockCall[] = [];
  let open: () => void = () => undefined;
  let gate = Promise.resolve();

  beforeAll(async () => {
    const started = await startAiFixture();
    if ('skip' in started) {
      skip = started.skip;
      return;
    }
    fx = started;
    const ai = fx.build();
    const { sql } = fx;
    const settings = ai.context.settings;
    await aiAdmin.updateAiSettings(ai.context, fx.admin, {
      privacy: { enabled: true },
      budget: { monthlyBudgetUsd: 10 },
    });
    guard = createDbBudgetGuard({ sql, settings });
    const model = createMockLanguageModel({
      next: async () => {
        await gate;
        return { text: 'done' };
      },
      calls,
      modelId: 'priced',
    });
    facade = createAiFacade({
      models: createStaticModelSource({
        language: { standard: { ...mockLanguage(model), capabilities: PRICED } },
      }),
      policy: createPolicySource({ sql, settings, allRolesAssigned: true }),
      runs: { record: (run) => insertRun(sql, run) },
      prompts: { render: () => Promise.reject(new Error('no prompts here')) },
      budget: guard,
      maxRetries: 0,
    });
    await sql`
      insert into ai_runs (role, purpose, input_hash, cost_usd, outcome)
      values ('standard', 'seed', 'h', 9.5, 'ok')`;
  });
  afterAll(async () => fx?.close());

  const reservations = async () => {
    const [row] = await fx!.sql<{ live: number; amount: string }[]>`
      select count(*)::int as live, coalesce(sum(amount_usd), 0)::text as amount
      from ai_budget_reservations where expires_at > now()`;
    return { live: row!.live, amount: Number(row!.amount) };
  };

  it('lets only the calls that fit through when ten race at the limit', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    gate = new Promise<void>((resolve) => (open = resolve));
    const settled = Array.from({ length: 10 }, () =>
      facade.generate({ ...CALL, maxOutputTokens: 100 }).then(
        (result) => ({ ok: true as const, result }),
        (error: unknown) => ({ ok: false as const, error }),
      ),
    );
    // $9.50 spent: holds of $0.20 take it to 9.70, 9.90 and 10.10; the rest see it spent.
    await vi.waitFor(async () => {
      expect(calls).toHaveLength(3);
      expect(await reservations()).toEqual({ live: 3, amount: 0.6 });
    });
    open();
    const outcomes = await Promise.all(settled);
    const passed = outcomes.filter((outcome) => outcome.ok);
    const refused = outcomes.filter((outcome) => !outcome.ok);
    expect(passed).toHaveLength(3);
    expect(calls).toHaveLength(3);
    expect(refused).toHaveLength(7);
    for (const outcome of refused) {
      expect(outcome.error).toMatchObject({
        details: { reason: 'budget_reached', role: 'standard' },
      });
    }
    expect(await reservations()).toEqual({ live: 0, amount: 0 });
    const [runs] = await fx.sql<{ count: number; cost: string }[]>`
      select count(*)::int as count, sum(cost_usd)::text as cost
      from ai_runs where purpose = 'budget-race'`;
    expect({ count: runs!.count, cost: Number(runs!.cost) }).toEqual({ count: 3, cost: 0.045 });
  });

  it('stops counting a hold once it expires, and drops it', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    gate = Promise.resolve();
    const before = calls.length;
    // A crashed process left a hold that would cover the rest of the budget.
    const [stale] = await fx.sql<{ id: string }[]>`
      insert into ai_budget_reservations (role, amount_usd, expires_at)
      values ('strong', 5, now() - interval '1 second') returning id`;
    await expect(facade.generate(CALL)).resolves.toMatchObject({ text: 'done' });
    expect(calls).toHaveLength(before + 1);
    expect(await fx.sql`select 1 from ai_budget_reservations where id = ${stale!.id}`).toHaveLength(
      0,
    );
    // The same hold, still live, refuses the next call.
    await fx.sql`
      insert into ai_budget_reservations (role, amount_usd, expires_at)
      values ('strong', 5, now() + interval '1 minute')`;
    await expect(facade.generate(CALL)).rejects.toMatchObject({
      details: { reason: 'budget_reached' },
    });
    expect(calls).toHaveLength(before + 1);
    await fx.sql`delete from ai_budget_reservations`;
  });

  it('holds nothing when no budget is set', async (ctx) => {
    if (!fx) return ctx.skip(skip);
    const ai = fx.build();
    await aiAdmin.updateAiSettings(ai.context, fx.admin, { budget: { monthlyBudgetUsd: null } });
    expect(await guard.reserve({ role: 'standard', estimateUsd: 100, ttlMs: 60_000 })).toBeNull();
    expect(await reservations()).toEqual({ live: 0, amount: 0 });
  });
});
