#!/usr/bin/env node
/**
 * Grows the load-test dataset for capacity runs, through supported bulk paths, and adds what
 * it grew to the dataset manifest so the k6 scripts use it:
 *
 *   --project LOADK [--kanban]   a project an import (src/jira/import.ts) just made: the
 *                                load-test people join it, --kanban switches its board, and
 *                                its issues (KEY-1..N) join the manifest
 *   --space LOADP --pages N      a space filled with N pages through the Docs markdown
 *                                import, 200 files a request, waiting for the import jobs
 *
 *   node perf/src/grow.ts --base-url … --credentials … --dataset load-dataset.json \
 *     --project LOADK --kanban
 */
import { parseArgs } from 'node:util';
import { ApiError, createApi, pool, type Api } from './clients/api.ts';
import { pageBody, pageTitle } from './lib/content.ts';
import { LOAD_PREFIX, readCredentials } from './lib/credentials.ts';
import { readDataset, writeDataset, type Dataset } from './lib/dataset.ts';
import { addInBatches } from './seed/work.ts';

const log = (line: string) => process.stderr.write(`${line}\n`);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// More than 200 pages in one import fails its realtime notice and the job retries (0.12.0).
const FILES_PER_IMPORT = 200;
const KEY = /^LOAD[A-Z0-9]{1,6}$/;

interface Named {
  id: string;
  key: string;
  name: string;
}

interface DocNode {
  type: string;
  attrs?: { level?: number };
  text?: string;
  content?: DocNode[];
}

const inner = (node: DocNode): string =>
  node.text ?? (node.content ?? []).map((child) => inner(child)).join('');

/** ProseMirror JSON to the Markdown the import reads: headings, paragraphs and lists. */
function markdownOf(doc: DocNode): string {
  return (doc.content ?? [])
    .map((block) => {
      if (block.type === 'heading') return `${'#'.repeat(block.attrs?.level ?? 2)} ${inner(block)}`;
      if (block.type === 'bulletList') {
        return (block.content ?? []).map((item) => `- ${inner(item)}`).join('\n');
      }
      return inner(block);
    })
    .join('\n\n');
}

async function growProject(api: Api, dataset: Dataset, key: string, kanban: boolean) {
  const project = await api.get<Named & { method: string }>(`/work/projects/by-key/${key}`);
  if (!project.name.startsWith(`${LOAD_PREFIX} `)) throw new Error(`${key} is not a LOAD project`);
  await addInBatches(api, `/work/projects/${key}/members`, dataset.userIds);
  if (kanban && project.method !== 'kanban')
    await api.patch(`/work/projects/${key}`, { method: 'kanban' });
  const types = await api.get<{ items: Named[] }>(`/work/projects/${key}/issue-types`);
  const boards = await api.get<{ items: Named[] }>(`/work/projects/${key}/boards`);
  const typeId = (types.items.find((t) => t.key === 'task') ?? types.items[0])?.id;
  const boardId = boards.items[0]?.id;
  if (!typeId || !boardId) throw new Error(`${key} has no issue type or board`);
  // Imported keys keep the source numbering, 1..N; count up until one is missing.
  let count = 0;
  for (let step = 262_144; step >= 1; step /= 2) {
    try {
      await api.get(`/work/issues/${key}-${count + step}`);
      count += step;
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  }
  const entry = {
    key,
    id: project.id,
    method: kanban ? ('kanban' as const) : (project.method as 'kanban' | 'scrum'),
    boardId,
    typeId,
    issueKeys: Array.from({ length: count }, (_, i) => `${key}-${i + 1}`),
  };
  dataset.projects = [...dataset.projects.filter((p) => p.key !== key), entry];
  log(`${key}: ${count} issues, ${entry.method}, ${dataset.userIds.length} people added`);
}

async function spacePageIds(api: Api, key: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: '200', ...(cursor ? { cursor } : {}) });
    const page: { items: { id: string }[]; nextCursor: string | null } = await api.get(
      `/docs/spaces/${key}/tree?${query}`,
    );
    ids.push(...page.items.map((item) => item.id));
    cursor = page.nextCursor;
  } while (cursor);
  return ids;
}

async function growSpace(api: Api, dataset: Dataset, key: string, pages: number, viaApi: boolean) {
  let space: Named & { pageCount: number };
  try {
    space = await api.get(`/docs/spaces/${key}`);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
    space = await api.post('/docs/spaces', { key, name: `${LOAD_PREFIX} Pages ${key}` });
    await addInBatches(api, `/docs/spaces/${key}/members`, dataset.userIds);
  }
  const start = space.pageCount ?? 0;
  if (viaApi) {
    // One page a request, in turn: the import job runs at about 3 pages a second on 2 vCPU,
    // the pages endpoint many times faster, and both are supported paths.
    const indexes = Array.from({ length: pages }, (_, i) => start + i);
    await pool(indexes, 1, (n) =>
      api.post('/docs/pages', {
        spaceId: space.id,
        title: pageTitle(key, n),
        snapshot: pageBody(n),
      }),
    );
  }
  const batches = viaApi
    ? []
    : Array.from({ length: Math.ceil(pages / FILES_PER_IMPORT) }, (_, b) => b);
  await pool(batches, 1, async (b) => {
    const files = Array.from(
      { length: Math.min(FILES_PER_IMPORT, pages - b * FILES_PER_IMPORT) },
      (_, i) => {
        const n = start + b * FILES_PER_IMPORT + i;
        return {
          path: `p-${String(n).padStart(6, '0')}.md`,
          content: `# ${pageTitle(key, n)}\n\n${markdownOf(pageBody(n) as DocNode)}\n`,
        };
      },
    );
    await api.post(`/docs/spaces/${key}/imports`, { format: 'markdown', files });
  });
  const target = start + pages;
  for (let waited = 0; ; waited += 5) {
    const now = await api.get<{ pageCount: number }>(`/docs/spaces/${key}`);
    if (now.pageCount >= target) break;
    if (waited % 60 === 0) log(`${key}: ${now.pageCount}/${target} pages`);
    await sleep(5000);
  }
  const pageIds = await spacePageIds(api, key);
  dataset.spaces = [...dataset.spaces.filter((s) => s.key !== key), { key, id: space.id, pageIds }];
  log(`${key}: ${pageIds.length} pages`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      credentials: { type: 'string' },
      dataset: { type: 'string' },
      project: { type: 'string' },
      kanban: { type: 'boolean', default: false },
      space: { type: 'string' },
      pages: { type: 'string', default: '0' },
      'pages-via-api': { type: 'boolean', default: false },
    },
  });
  if (!values['base-url'] || !values.credentials || !values.dataset) {
    throw new Error('--base-url, --credentials and --dataset are required');
  }
  for (const key of [values.project, values.space]) {
    if (key && !KEY.test(key)) throw new Error(`${key} must look like LOADK`);
  }
  const api = createApi(values['base-url'], readCredentials(values.credentials).admin.token);
  const dataset = readDataset(values.dataset);
  if (values.project) await growProject(api, dataset, values.project, values.kanban);
  if (values.space && Number(values.pages) > 0) {
    await growSpace(api, dataset, values.space, Number(values.pages), values['pages-via-api']);
  }
  writeDataset(values.dataset, dataset);
}

await main();
