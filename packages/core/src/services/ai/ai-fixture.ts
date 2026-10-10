import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ForbiddenError } from '@bemmoly/shared';
import { pino } from 'pino';
import type { ModelsDevClient } from '../../clients/models-dev.ts';
import { createSqlClient, type SqlClient } from '../../clients/postgres.ts';
import type { Actor, Authorize } from '../../contracts/authz.ts';
import type { DomainEvent } from '../../contracts/event-bus.ts';
import { createIsolatedDatabase, type IsolatedDatabase } from '../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import {
  createSecretBox,
  createSettingsCatalog,
  createSettingsService,
  createSettingsStore,
  KERNEL_SETTINGS,
} from '../settings/index.ts';
import { createAiService, type AiServiceDependencies } from './service.ts';
import { AI_SETTING_DEFINITIONS } from './settings.ts';

export const SECRET_KEY = Buffer.alloc(32, 9).toString('base64');

export const PROMPT = `---
id: ai.fixture_summary
version: 1
role: standard
description: A summary for the integration test
variables: [title]
---
# System

Be brief.

# Prompt

Summarise {{title}}.
`;

/** models.dev that never answers, unless a test scripts it. */
export function scriptedModelsDev(script: (() => unknown)[] = []): ModelsDevClient {
  return {
    async fetchCatalog() {
      const next = script.shift();
      if (!next) throw new Error('models.dev unreachable');
      return { status: 'fresh', etag: '"test"', body: next() };
    },
    fetchLogo: async () => null,
  };
}

export interface AiFixture {
  sql: SqlClient;
  admin: Actor;
  member: Actor;
  events: DomainEvent[];
  promptFile: string;
  build(change?: Partial<AiServiceDependencies>): ReturnType<typeof createAiService>;
  close(): Promise<void>;
}

/** A real Postgres with the kernel changelog, an admin and a member, and an AI service factory. */
export async function startAiFixture(): Promise<AiFixture | { skip: string }> {
  const server: TestDatabase = await startTestDatabase();
  if (!server.available) return { skip: server.reason };
  const database: IsolatedDatabase = await createIsolatedDatabase(server.url);
  const sql = createSqlClient(database.url, { maxConnections: 4 });
  await applyKernelChangelog(sql);
  const insertUser = async (email: string, role: string) => {
    const [row] = await sql<{ id: string }[]>`
      insert into users (email, name, role_id)
      select ${email}, ${email.split('@')[0]!}, id from roles where key = ${role}
      returning id`;
    return { kind: 'user' as const, id: row!.id };
  };
  const admin = await insertUser('admin@acme.test', 'org_admin');
  const member = await insertUser('rohan@acme.test', 'member');
  const authorize: Authorize = async (actor) => {
    if (actor.id !== admin.id) throw new ForbiddenError('Only admins configure AI');
  };
  const settings = createSettingsService({
    store: createSettingsStore(sql),
    catalog: createSettingsCatalog(undefined, [...KERNEL_SETTINGS, ...AI_SETTING_DEFINITIONS]),
    secrets: createSecretBox(SECRET_KEY),
    logger: pino({ level: 'silent' }),
  });
  const dir = await mkdtemp(join(tmpdir(), 'bemmoly-ai-'));
  const promptFile = join(dir, 'summary.md');
  await writeFile(promptFile, PROMPT);
  const events: DomainEvent[] = [];
  return {
    sql,
    admin,
    member,
    events,
    promptFile,
    build: (change = {}) =>
      createAiService({
        sql,
        secrets: createSecretBox(SECRET_KEY),
        settings,
        authorize,
        events: { publish: async (event) => void events.push(event), subscribe: () => () => {} },
        appVersion: '0.5.0',
        kernelPromptFiles: [promptFile],
        modelsDev: scriptedModelsDev(),
        ...change,
      }),
    async close() {
      await sql.end({ timeout: 5 });
      await database.drop();
      await server.stop();
    },
  };
}
