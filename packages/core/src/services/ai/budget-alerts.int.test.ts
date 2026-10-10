import { type NotificationListResponse } from '@bemmoly/shared';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDatabase } from '../../clients/drizzle.ts';
import type { DirectoryUser } from '../../contracts/users.ts';
import { startHarness, type Harness } from '../../testing/email-notifications-harness.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { createAuthorize } from '../authz/index.ts';
import {
  createSecretBox,
  createSettingsCatalog,
  createSettingsService,
  createSettingsStore,
  KERNEL_SETTINGS,
} from '../settings/index.ts';
import { aiAdmin } from './index.ts';
import { SECRET_KEY, scriptedModelsDev } from './ai-fixture.ts';
import { subscribeAiBudgetAlerts } from './budget-alerts.ts';
import { AI_BUDGET_THRESHOLD, watchBudget } from './budget-watch.ts';
import { createAiService, type AiService } from './service.ts';
import { AI_SETTING_DEFINITIONS } from './settings.ts';

interface OutboxRow {
  kind: string;
  to_address: string;
  subject: string;
  text: string;
}

describe('AI budget alerts reach the admins who configure AI', () => {
  let server: TestDatabase;
  let h: Harness;
  let ai: AiService;
  const people = {} as Record<'rohan' | 'jonas' | 'aisha' | 'zoe', DirectoryUser>;

  const inbox = async (user: DirectoryUser) =>
    (
      await h.app.inject({ url: '/api/v1/notifications', headers: { 'x-test-user': user.id } })
    ).json<NotificationListResponse>();
  const outbox = () =>
    h.sql<
      OutboxRow[]
    >`select kind, to_address, subject, text from email_outbox order by to_address`;
  const rows = () =>
    h.sql<{ user_id: string; body: string }[]>`select user_id, body from notifications`;
  const spend = (usd: number) =>
    h.sql`insert into ai_runs (role, purpose, input_hash, cost_usd, outcome)
          values ('standard', 'summary', 'h', ${usd}, 'ok')`;
  const settle = async (count: number) => {
    for (let tries = 0; tries < 100 && (await rows()).length < count; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  beforeAll(async () => {
    server = await startTestDatabase();
    if (!server.available) return;
    h = await startHarness(server, () => []);
    people.rohan = await h.addUser('Rohan', 'rohan@acme.test');
    people.jonas = await h.addUser('Jonas M.', 'jonas@acme.test');
    people.aisha = await h.addUser('Aisha K.', 'aisha@acme.test');
    people.zoe = await h.addUser('Zoe', 'zoe@acme.test');
    // Rohan is an org admin; Jonas holds a custom role granted the AI capability; Zoe was an
    // org admin and is deactivated; Aisha is a member.
    await h.sql`update users set role_id = (select id from roles where key = 'org_admin')
                where id in (${people.rohan.id}, ${people.zoe.id})`;
    await h.sql`update users set status = 'deactivated' where id = ${people.zoe.id}`;
    const [steward] = await h.sql<{ id: string }[]>`
      insert into roles (key, name) values ('ai_steward', 'AI steward') returning id`;
    await h.sql`insert into role_capabilities (role_id, capability, allowed)
                values (${steward!.id}, 'ai.models.configure', true)`;
    await h.sql`update users set role_id = ${steward!.id} where id = ${people.jonas.id}`;
    const authorize = createAuthorize({
      db: createDatabase(h.sql),
      modules: { ids: () => [], capabilities: () => [] },
    });
    subscribeAiBudgetAlerts({ sql: h.sql, authorize, events: h.events });
    ai = createAiService({
      sql: h.sql,
      secrets: createSecretBox(SECRET_KEY),
      settings: createSettingsService({
        store: createSettingsStore(h.sql),
        catalog: createSettingsCatalog(undefined, [...KERNEL_SETTINGS, ...AI_SETTING_DEFINITIONS]),
        secrets: createSecretBox(SECRET_KEY),
        logger: pino({ level: 'silent' }),
      }),
      authorize,
      events: h.events,
      appVersion: '0.5.0',
      modelsDev: scriptedModelsDev(),
    });
    const admin = { kind: 'user' as const, id: people.rohan.id, userId: people.rohan.id };
    await aiAdmin.updateAiSettings(ai.context, admin, { budget: { monthlyBudgetUsd: 50 } });
  });

  afterAll(async () => {
    if (!server.available) return;
    await h.stop();
    await server.stop();
  });

  beforeEach((ctx) => {
    if (!server.available) ctx.skip(server.reason);
  });

  it('tells each admin once at 80%, in the inbox and by email, with a link to usage', async () => {
    await spend(41.2);
    watchBudget(ai.context).check();
    await settle(2);
    expect((await rows()).map((row) => row.user_id).sort()).toEqual(
      [people.rohan.id, people.jonas.id].sort(),
    );
    const [entry] = (await inbox(people.rohan)).items;
    expect(entry).toMatchObject({
      kind: 'ai_budget',
      summary: expect.stringMatching(/^Bemmoly says AI has used 80% of \w+'s budget$/),
      body: expect.stringContaining("AI has used 80% of this month's $50 budget."),
      target: { kind: 'ai_usage', url: 'https://bemmoly.example.com/settings/ai/usage' },
    });
    expect((await inbox(people.aisha)).items).toHaveLength(0);
    const mail = await outbox();
    expect(mail.map((row) => row.to_address)).toEqual(['jonas@acme.test', 'rohan@acme.test']);
    expect(mail[0]).toMatchObject({
      kind: 'notification.ai_budget',
      subject: expect.stringMatching(/has used 80% of this month's budget$/),
    });
    expect(mail[0]?.text).toContain('$41.20 is spent so far.');
    expect(mail[0]?.text).toContain('https://bemmoly.example.com/settings/ai/usage');
    expect(mail[0]?.text).toContain('you can configure AI for this workspace');
  });

  it('says nothing more when the watch runs again or the event repeats', async () => {
    watchBudget(ai.context).check();
    const month = new Date().toISOString().slice(0, 7);
    const repeat = { month, state: 'warning', spentUsd: 41.2, budgetUsd: 50 };
    await h.events.publish({ kind: AI_BUDGET_THRESHOLD, occurredAt: new Date(), payload: repeat });
    await h.events.publish({ kind: AI_BUDGET_THRESHOLD, occurredAt: new Date(), payload: repeat });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await rows()).toHaveLength(2);
    expect(await outbox()).toHaveLength(2);
  });

  it('tells them again, in plain words, when standard and strong pause at 100%', async () => {
    await spend(9);
    watchBudget(ai.context).check();
    await settle(4);
    const paused = (await rows()).filter((row) => row.body.includes('paused'));
    expect(paused).toHaveLength(2);
    const next = new Date();
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    const resumes = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(next);
    expect(paused[0]?.body).toBe(
      `AI has used all of this month's $50 budget. Standard and strong AI are paused until ${resumes} or until the budget is raised. Fast AI keeps working.`,
    );
    const mail = (await outbox()).filter((row) => row.subject.includes("used this month's"));
    expect(mail.map((row) => row.to_address)).toEqual(['jonas@acme.test', 'rohan@acme.test']);
  });

  it('ignores a malformed event instead of failing the publisher', async () => {
    await h.events.publish({
      kind: AI_BUDGET_THRESHOLD,
      occurredAt: new Date(),
      payload: { month: 'soon', state: 'warning' },
    });
    expect(await rows()).toHaveLength(4);
  });
});
