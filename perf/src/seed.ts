#!/usr/bin/env node
/**
 * Seeds the sample dataset of tech design §20 through the public API, as the load-test
 * people from provision.ts: 3 projects (one a 500-issue kanban board), 5,000 issues and
 * 400 pages in 2 spaces. Writes the manifest the k6 scripts read.
 *
 *   node perf/src/seed.ts --base-url https://bemmoly.example.com \
 *     --credentials load-credentials.json --out load-dataset.json
 *
 * Refuses to run while any LOAD project or space exists: run teardown.ts first.
 */
import { parseArgs } from 'node:util';
import { ApiError, createApi, pool, type Api } from './clients/api.ts';
import { searchTerms } from './lib/content.ts';
import { readCredentials } from './lib/credentials.ts';
import { samplePlan, writeDataset, type Dataset } from './lib/dataset.ts';
import { seedSpace } from './seed/docs.ts';
import { seedProject, type SeedContext } from './seed/work.ts';

const log = (line: string) => process.stderr.write(`${line}\n`);

interface Me {
  user: { id: string };
  modules: string[];
}

async function exists(api: Api, path: string): Promise<boolean> {
  try {
    await api.get(path);
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    throw error;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      credentials: { type: 'string' },
      out: { type: 'string' },
      issues: { type: 'string', default: '5000' },
      'board-issues': { type: 'string', default: '500' },
      pages: { type: 'string', default: '400' },
      // Writes in flight at once. One by default: up to 0.11.0, ten or more concurrent writes
      // that notify people (status changes, comments, assignments) could exhaust the server's
      // connection pool and hang it. Seeding is setup; the load scripts test concurrency.
      concurrency: { type: 'string', default: '1' },
    },
  });
  if (!values['base-url'] || !values.credentials || !values.out) {
    throw new Error('--base-url, --credentials and --out are required');
  }
  const baseUrl = values['base-url'];
  const credentials = readCredentials(values.credentials);
  const plan = samplePlan({
    issues: Number(values.issues),
    boardIssues: Number(values['board-issues']),
    pages: Number(values.pages),
  });
  const admin = createApi(baseUrl, credentials.admin.token);
  const people = credentials.users.map((person) => createApi(baseUrl, person.token));

  const me = await admin.get<Me>('/me');
  for (const module of ['work', 'docs']) {
    if (!me.modules.includes(module))
      throw new Error(`The ${module} module is not enabled for the load admin`);
  }
  for (const project of plan.projects) {
    if (await exists(admin, `/work/projects/by-key/${project.key}`)) {
      throw new Error(`Project ${project.key} exists; run perf/src/teardown.ts first`);
    }
  }
  for (const space of plan.spaces) {
    if (await exists(admin, `/docs/spaces/${space.key}`)) {
      throw new Error(`Space ${space.key} exists; run perf/src/teardown.ts first`);
    }
  }

  const started = performance.now();
  const userIds = await pool(people, 8, async (api) => (await api.get<Me>('/me')).user.id);
  const ctx: SeedContext = { admin, people, userIds, concurrency: Number(values.concurrency), log };
  log(`Seeding ${baseUrl} as ${credentials.admin.email} with ${people.length} people`);

  const projects = [];
  let offset = 0;
  for (const project of plan.projects) {
    projects.push(await seedProject(ctx, project, offset));
    offset += project.issues;
  }
  const spaces = [];
  offset = 0;
  for (const space of plan.spaces) {
    spaces.push(await seedSpace(ctx, space, offset));
    offset += space.pages;
  }

  const dataset: Dataset = {
    createdAt: new Date().toISOString(),
    baseUrl,
    adminId: me.user.id,
    userIds,
    projects,
    spaces,
    boardProjectKey: plan.projects[0]?.key ?? '',
    searchTerms: searchTerms(),
  };
  writeDataset(values.out, dataset);
  const minutes = ((performance.now() - started) / 60_000).toFixed(1);
  const issues = projects.reduce((sum, p) => sum + p.issueKeys.length, 0);
  const pages = spaces.reduce((sum, s) => sum + s.pageIds.length, 0);
  log(`Seeded ${projects.length} projects, ${issues} issues, ${pages} pages in ${minutes} min`);
}

await main();
