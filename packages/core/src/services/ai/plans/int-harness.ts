import { readFile } from 'node:fs/promises';
import { NotFoundError } from '@bemmoly/shared';
import { z } from 'zod';
import { createDatabase } from '../../../clients/drizzle.ts';
import { createSqlClient, type SqlClient } from '../../../clients/postgres.ts';
import type { Actor } from '../../../contracts/authz.ts';
import type { RealtimeMessage } from '../../../contracts/realtime.ts';
import { createIsolatedDatabase } from '../../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import { startTestDatabase } from '../../../testing/postgres.ts';
import { createRequestAuthorization, type RequestContext } from '../../authz/index.ts';
import { parsePromptFile } from '../prompts/parse.ts';
import { createTestAi, type TestAi } from '../test-ai.ts';
import { aiToolContribution, defineReadTool, defineWriteTool } from '../tools/define.ts';
import { wireAiPlans, PLAN_PROMPT_FILE, type AiPlans } from './wire.ts';

/*
 * A real Postgres with the kernel changelog, three people, and a stand-in module ("notes")
 * whose tools write a scratch table: the kernel never imports a module, so its own plan tests
 * bring their own tools. The run job is captured and run by hand.
 */

export interface PlanHarness {
  sql: SqlClient;
  ai: TestAi;
  plans: AiPlans;
  users: { admin: string; member: string; viewer: string };
  realtime: RealtimeMessage[];
  enqueued: { name: string; payload: object; key?: string }[];
  as(userId: string): RequestContext;
  /** Runs every job enqueued so far, as the queue would, and clears the list. */
  drain(): Promise<void>;
  note(title: string): Promise<string>;
  titles(): Promise<string[]>;
  stop(): Promise<void>;
}

const noteInput = z.object({ id: z.uuid() });
const renameInput = noteInput.extend({ title: z.string().trim().min(1).max(200) });

async function findNote(sql: SqlClient, id: string) {
  const [row] = await sql<{ id: string; title: string }[]>`
    select id, title from test_notes where id = ${id}`;
  if (!row) throw new NotFoundError('The note was not found');
  return row;
}

function noteTools(sql: SqlClient) {
  const getNote = defineReadTool({
    name: 'notes_get',
    kind: 'read',
    description: 'One note by id.',
    input: noteInput,
    execute: async (_ctx, { id }) => findNote(sql, id),
  });
  const rename = defineWriteTool<z.infer<typeof renameInput>, { title: string }>({
    name: 'notes_rename',
    kind: 'write',
    description: 'Rename a note.',
    input: renameInput,
    idempotent: true,
    describe: async (_ctx, { id, title }) => {
      const note = await findNote(sql, id);
      return {
        target: note.title,
        change: 'Rename',
        field: null,
        from: note.title,
        to: title,
        href: null,
      };
    },
    authorize: async (ctx, { id }) => {
      await findNote(sql, id);
      await ctx.authz.authorize(ctx.actor, 'ai.assist.use', { kind: 'workspace' });
    },
    run: async (_ctx, { id, title }) => {
      const before = await findNote(sql, id);
      await sql`update test_notes set title = ${title} where id = ${id}`;
      return { undo: { title: before.title } };
    },
    undo: async (ctx, { title }) => {
      await sql`update test_notes set title = ${title} where id = (
        select (args->>'id')::uuid from ai_plan_steps
        where plan_id = ${ctx.planId} and step_index = ${ctx.stepIndex})`;
    },
  });
  // Only an org admin may delete; a member's proposal is DENIED.
  const remove = defineWriteTool<z.infer<typeof noteInput>>({
    name: 'notes_delete',
    kind: 'write',
    description: 'Delete a note.',
    input: noteInput,
    idempotent: false,
    describe: async (_ctx, { id }) => {
      const note = await findNote(sql, id);
      return {
        target: note.title,
        change: 'Delete',
        field: null,
        from: null,
        to: null,
        href: null,
      };
    },
    authorize: async (ctx) => {
      await ctx.authz.authorize(ctx.actor, 'workspace.settings.manage', { kind: 'workspace' });
    },
    run: async (ctx, { id }) => {
      await sql`update test_notes set title = title || ${` (deleted ${ctx.attribution})`}
        where id = ${id}`;
      return {};
    },
  });
  return [getNote, rename, remove];
}

async function seedPerson(sql: SqlClient, email: string, roleKey: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    select ${email}, ${email.split('@')[0] ?? email}, id from roles where key = ${roleKey}
    returning id`;
  if (!row) throw new Error(`The ${roleKey} role is not seeded`);
  return row.id;
}

export async function startPlanHarness(): Promise<PlanHarness | { skipped: string }> {
  const server = await startTestDatabase();
  if (!server.available) return { skipped: server.reason };
  const database = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 8 });
  await applyKernelChangelog(sql);
  await sql`create table test_notes (id uuid primary key default uuidv7(), title text not null)`;
  await sql`insert into module_grants (module_id, subject_kind) values ('notes', 'everyone')`;
  const users = {
    admin: await seedPerson(sql, 'rohan@example.test', 'org_admin'),
    member: await seedPerson(sql, 'mo@example.test', 'member'),
    viewer: await seedPerson(sql, 'vi@example.test', 'viewer'),
  };
  const tools = noteTools(sql).map((tool) => ({ ...aiToolContribution(tool), moduleId: 'notes' }));
  const modules = { ids: () => ['notes'], capabilities: () => [], aiTools: () => tools };
  const db = createDatabase(sql);
  const ai = createTestAi();
  const prompt = parsePromptFile(await readFile(PLAN_PROMPT_FILE, 'utf8'), PLAN_PROMPT_FILE);
  ai.addPrompt(prompt.id, {
    role: prompt.role,
    system: prompt.system,
    prompt: prompt.template,
    outputSchema: null,
    version: prompt.version,
  });
  const realtime: RealtimeMessage[] = [];
  const enqueued: PlanHarness['enqueued'] = [];
  const handlers = new Map<string, (payload: unknown) => Promise<void>>();
  const plans = wireAiPlans({
    sql,
    db,
    modules,
    ai: () => ai,
    realtime: { publish: async (message) => void realtime.push(message) },
    jobs: {
      register: (name, handler) =>
        void handlers.set(name, (payload) =>
          handler(payload as never, { jobId: 'test', signal: new AbortController().signal }),
        ),
      enqueue: async (name, payload, options) => {
        enqueued.push({ name, payload, ...(options?.key ? { key: options.key } : {}) });
        return name;
      },
    },
  });
  const as = (userId: string): RequestContext => ({
    actor: { kind: 'user', id: userId } satisfies Actor,
    authz: createRequestAuthorization({ db, modules }),
  });
  return {
    sql,
    ai,
    plans,
    users,
    realtime,
    enqueued,
    as,
    async drain() {
      for (const job of enqueued.splice(0)) await handlers.get(job.name)?.(job.payload);
    },
    async note(title) {
      const [row] = await sql<{ id: string }[]>`
        insert into test_notes (title) values (${title}) returning id`;
      return row!.id;
    },
    async titles() {
      const rows = await sql<{ title: string }[]>`select title from test_notes order by id`;
      return rows.map((row) => row.title);
    },
    async stop() {
      await sql.end();
      await database.drop();
      await server.stop();
    },
  };
}
