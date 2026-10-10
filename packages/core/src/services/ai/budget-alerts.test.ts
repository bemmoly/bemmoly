import { ForbiddenError } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { budgetAdmins, budgetAlertCopy, budgetAlertRequest } from './budget-alerts.ts';

describe('the AI budget alert copy', () => {
  it('warns at 80% with the budget, the spend and when AI would pause', () => {
    expect(
      budgetAlertCopy({ month: '2026-10', state: 'warning', spentUsd: 41.2, budgetUsd: 50 }),
    ).toEqual({
      label: "80% of October's budget",
      headline: "AI has used 80% of this month's $50 budget.",
      detail: '$41.20 is spent so far. At 100%, standard and strong AI pause until 1 November.',
    });
  });

  it('says what is paused and until when at 100%, across a year end', () => {
    expect(
      budgetAlertCopy({ month: '2026-12', state: 'paused', spentUsd: 75.5, budgetUsd: 75.5 }),
    ).toEqual({
      label: "all of December's budget",
      headline: "AI has used all of this month's $75.50 budget.",
      detail:
        'Standard and strong AI are paused until 1 January or until the budget is raised. Fast AI keeps working.',
    });
  });

  it('asks for one inbox row per admin, keyed by month and state, linked to usage', () => {
    const request = budgetAlertRequest(
      { month: '2026-10', state: 'paused', spentUsd: 50, budgetUsd: 50 },
      ['u1', 'u2'],
    );
    expect(request).toMatchObject({
      kind: 'ai_budget',
      recipientIds: ['u1', 'u2'],
      target: { kind: 'ai_usage', id: '2026-10', url: '/settings/ai/usage' },
      dedupeKey: 'ai-budget:2026-10:paused',
      data: { state: 'paused', headline: "AI has used all of this month's $50 budget." },
    });
    expect(request).not.toHaveProperty('actorId');
  });
});

describe('who hears about the budget', () => {
  it('checks one person per role and keeps everyone in the roles that may configure AI', async () => {
    const users = [
      { id: 'a1', role_id: 'admin' },
      { id: 'a2', role_id: 'admin' },
      { id: 'm1', role_id: 'member' },
      { id: 'm2', role_id: 'member' },
    ];
    const sql = (async () => users) as unknown as SqlExecutor;
    const checked: string[] = [];
    const admins = await budgetAdmins(sql, async (actor) => {
      checked.push(actor.id);
      if (!actor.id.startsWith('a')) throw new ForbiddenError('no');
    });
    expect(admins).toEqual(['a1', 'a2']);
    expect(checked).toEqual(['a1', 'm1']);
  });

  it('lets an unexpected authorization failure surface', async () => {
    const sql = (async () => [{ id: 'a1', role_id: 'admin' }]) as unknown as SqlExecutor;
    await expect(
      budgetAdmins(sql, async () => {
        throw new Error('database down');
      }),
    ).rejects.toThrow('database down');
  });
});
