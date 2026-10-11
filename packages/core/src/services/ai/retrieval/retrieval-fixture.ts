import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import type { SqlClient } from '../../../clients/postgres.ts';
import type { RetrievalDocument, RetrievalSourceDefinition } from '../../../contracts/retrieval.ts';
import type { SearchProviderDefinition } from '../../../modules/registries.ts';
import type { FromModule } from '../../../modules/registry.ts';
import { fakeJobQueue, type FakeJobQueue } from '../../../testing/fakes.ts';
import {
  createIsolatedDatabase,
  type IsolatedDatabase,
} from '../../../testing/isolated-database.ts';
import { applyKernelChangelog } from '../../../testing/kernel-changelog.ts';
import type { RequestContext } from '../../authz/index.ts';
import { parsePromptFile } from '../prompts/parse.ts';
import { createTestAi, type TestAi } from '../test-ai.ts';
import {
  createRetrievalService,
  type RetrievalDependencies,
  type RetrievalService,
} from './index.ts';
import { ANSWER_PROMPT_FILE } from './prompt.ts';

/*
 * A small wiki for retrieval tests: pages in spaces, people who read some spaces, a keyword
 * provider that (deliberately) ignores access so the per-record check is what keeps secrets
 * out, and the real service over real Postgres with the test AI.
 */

export const SPACE_OPEN = '0199c0de-0000-7000-8000-00000000a001';
export const SPACE_SECRET = '0199c0de-0000-7000-8000-00000000a002';

export interface WikiPage {
  id: string;
  spaceId: string;
  title: string;
  sections: { heading: string; text: string; authorId: string | null }[];
}

export interface Fixture {
  /** The isolated database, for a test that runs a real queue on it. */
  url: string;
  sql: SqlClient;
  /** What `service` was built from, to build another over a different queue. */
  deps: RetrievalDependencies;
  ai: TestAi;
  jobs: FakeJobQueue;
  service: RetrievalService;
  pages: Map<string, WikiPage>;
  users: { reader: string; insider: string; writer: string; quiet: string };
  /** Who reads which spaces; an id missing here reads none. */
  readers: Map<string, string[]>;
  keywordOrder: { override: string[] | null };
  contextFor(userId: string): RequestContext;
  close(): Promise<void>;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function wikiSource(fixture: () => Fixture): FromModule<RetrievalSourceDefinition> {
  const load = (page: WikiPage): RetrievalDocument => ({
    id: page.id,
    title: page.title,
    path: `/wiki/${page.id}`,
    containerId: page.spaceId,
    chunks: page.sections.map((section) => ({
      text: section.text,
      authorId: section.authorId,
      location: { label: section.heading, anchor: slug(section.heading), part: 'body' },
    })),
  });
  return {
    moduleId: 'wiki',
    kind: 'wiki.page',
    noun: { one: 'page', other: 'pages' },
    container: 'space',
    changeKinds: ['wiki.page'],
    list: async ({ after, limit }) =>
      [...fixture().pages.keys()]
        .sort()
        .filter((id) => after === null || id > after)
        .slice(0, limit),
    load: async (ids) =>
      ids.flatMap((id) => {
        const page = fixture().pages.get(id);
        return page ? [load(page)] : [];
      }),
    readableContainers: async (ctx) => fixture().readers.get(ctx.actor.id) ?? [],
    visible: async (ctx, ids) => {
      const spaces = fixture().readers.get(ctx.actor.id) ?? [];
      return new Set(ids.filter((id) => spaces.includes(fixture().pages.get(id)?.spaceId ?? '')));
    },
  };
}

function wikiKeyword(fixture: () => Fixture): FromModule<SearchProviderDefinition> {
  return {
    moduleId: 'wiki',
    kind: 'wiki.page',
    label: 'Pages',
    search: async (_ctx, query) => {
      const { override } = fixture().keywordOrder;
      const words = query.q
        .toLowerCase()
        .split(/\W+/)
        .filter((word) => word.length > 3);
      const ids =
        override ??
        [...fixture().pages.values()]
          .filter((page) => {
            const text = `${page.title} ${page.sections.map((s) => s.text).join(' ')}`;
            return words.some((word) => text.toLowerCase().includes(word));
          })
          .map((page) => page.id);
      return ids.map((id) => ({
        id,
        title: fixture().pages.get(id)?.title ?? id,
        subtitle: null,
        href: `/wiki/${id}`,
      }));
    },
  };
}

async function addUser(sql: SqlClient, name: string): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into users (email, name, role_id)
    values (${`${name}@example.test`}, ${name}, (select id from roles order by id limit 1))
    returning id`;
  return row!.id;
}

export async function createFixture(serverUrl: string, dimensions = 8): Promise<Fixture> {
  const database: IsolatedDatabase = await createIsolatedDatabase(serverUrl);
  const sql = postgres(database.url, { max: 4, onnotice: () => undefined });
  await applyKernelChangelog(sql);
  const users = {
    reader: await addUser(sql, 'reader'),
    insider: await addUser(sql, 'insider'),
    writer: await addUser(sql, 'writer'),
    quiet: await addUser(sql, 'quiet'),
  };
  const ai = createTestAi({ dimensions });
  const answer = parsePromptFile(await readFile(ANSWER_PROMPT_FILE, 'utf8'), ANSWER_PROMPT_FILE);
  ai.addPrompt(answer.id, {
    role: answer.role,
    version: answer.version,
    system: answer.system,
    prompt: answer.template,
    outputSchema: answer.output_schema,
  });
  const jobs = fakeJobQueue();
  const box: { fixture?: Fixture } = {};
  const current = () => box.fixture!;
  const deps: RetrievalDependencies = {
    sql,
    ai: () => ai,
    sources: () => [wikiSource(current)],
    keyword: () => [wikiKeyword(current)],
    isEnabled: () => true,
    jobs,
  };
  const service = createRetrievalService(deps);
  for (const job of service.jobs()) jobs.register(job.name, (payload) => job.handle(payload));
  box.fixture = {
    url: database.url,
    sql,
    deps,
    ai,
    jobs,
    service,
    pages: new Map(),
    users,
    readers: new Map([
      [users.reader, [SPACE_OPEN]],
      [users.insider, [SPACE_OPEN, SPACE_SECRET]],
    ]),
    keywordOrder: { override: null },
    contextFor: (userId) =>
      ({
        actor: { kind: 'user', id: userId },
        authz: { modulesFor: async () => new Set(['wiki']), authorize: async () => undefined },
        requestId: 'req-retrieval',
      }) as unknown as RequestContext,
    async close() {
      await sql.end({ timeout: 5 });
      await database.drop();
    },
  };
  return box.fixture;
}

export async function storedRows(sql: SqlClient) {
  return sql<
    { target_id: string; chunk_index: number; text: string; space_id: string; model: string }[]
  >`select target_id, chunk_index, text, space_id, model from embeddings
    order by target_id, chunk_index`;
}
