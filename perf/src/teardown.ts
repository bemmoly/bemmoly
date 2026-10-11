#!/usr/bin/env node
/**
 * Removes what the harness made, through the API as the load admin: every project and space
 * whose key starts with LOAD and whose name starts with "LOAD " (seeded or imported) is
 * archived, then deleted with everything in it. Nothing else is touched. Afterwards run
 * perf/sql/teardown.sql to revoke the tokens and deactivate the load-test people.
 *
 *   node perf/src/teardown.ts --base-url https://… --credentials load-credentials.json
 */
import { parseArgs } from 'node:util';
import { ApiError, createApi, type Api } from './clients/api.ts';
import { LOAD_PREFIX, readCredentials } from './lib/credentials.ts';

const log = (line: string) => process.stderr.write(`${line}\n`);

interface Owned {
  key: string;
  name: string;
  archivedAt: string | null;
}

/** Only what the harness names: a LOAD key and a "LOAD " name, both. */
export const isLoadOwned = (item: { key: string; name: string }) =>
  new RegExp(`^${LOAD_PREFIX}[A-Z0-9]*$`).test(item.key) && item.name.startsWith(`${LOAD_PREFIX} `);

async function listAll(api: Api, path: string): Promise<Owned[]> {
  const items: Owned[] = [];
  for (const archived of ['false', 'true']) {
    let cursor: string | null = null;
    do {
      const query = new URLSearchParams({ limit: '100', archived, ...(cursor ? { cursor } : {}) });
      const page: { items: Owned[]; nextCursor: string | null } = await api.get(`${path}?${query}`);
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
  }
  // A listing that includes archived rows may repeat live ones; act on each key once.
  return [...new Map(items.map((item) => [item.key, item])).values()];
}

async function ignoreMissing(work: Promise<unknown>) {
  try {
    await work;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
}

async function removeProjects(api: Api) {
  const projects = (await listAll(api, '/work/projects')).filter(isLoadOwned);
  for (const project of projects) {
    if (!project.archivedAt) await ignoreMissing(api.post(`/work/projects/${project.key}/archive`));
    await ignoreMissing(api.del(`/work/projects/${project.key}`));
    log(`Deleted project ${project.key} (${project.name})`);
  }
  return projects.length;
}

async function removeSpaces(api: Api) {
  const spaces = (await listAll(api, '/docs/spaces')).filter(isLoadOwned);
  for (const space of spaces) {
    if (!space.archivedAt)
      await ignoreMissing(api.patch(`/docs/spaces/${space.key}`, { archived: true }));
    await ignoreMissing(api.del(`/docs/spaces/${space.key}`));
    log(`Deleted space ${space.key} (${space.name})`);
  }
  return spaces.length;
}

async function main() {
  const { values } = parseArgs({
    options: { 'base-url': { type: 'string' }, credentials: { type: 'string' } },
  });
  if (!values['base-url'] || !values.credentials) {
    throw new Error('--base-url and --credentials are required');
  }
  const credentials = readCredentials(values.credentials);
  const api = createApi(values['base-url'], credentials.admin.token);
  const projects = await removeProjects(api);
  const spaces = await removeSpaces(api);
  log(`Removed ${projects} projects and ${spaces} spaces. Now run perf/sql/teardown.sql.`);
}

if (import.meta.main) await main();
