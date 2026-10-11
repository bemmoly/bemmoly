import type {
  ImportConnection,
  ImportPlanContext,
  ImportSourceContext,
  SqlClient,
} from '@bemmoly/core';
import type { ImportDiscovery, ImportMapping, ImportPlan } from '@bemmoly/shared';
import {
  confluenceClientFor,
  explainConfluenceError,
  parseConfluenceConnection,
  spaceKeyFrom,
} from './connection.ts';

const COUNTED_SPACES = 200;

/** Tests the token and lists the global spaces, each with its page count. */
export async function discoverConfluence(
  connection: ImportConnection,
  ctx: ImportSourceContext,
): Promise<ImportDiscovery> {
  const parsed = parseConfluenceConnection(connection);
  const client = confluenceClientFor(connection, ctx);
  try {
    await client.currentUser();
    const spaces = await client.spaces();
    const counts: number[] = [];
    for (let start = 0; start < Math.min(spaces.length, COUNTED_SPACES); start += 6) {
      const batch = spaces.slice(start, Math.min(start + 6, COUNTED_SPACES));
      counts.push(...(await Promise.all(batch.map((space) => client.countPages(space.key)))));
    }
    const warnings: string[] = [];
    if (spaces.length > COUNTED_SPACES) {
      warnings.push(`Pages were counted for the first ${COUNTED_SPACES} spaces only.`);
    }
    if (!spaces.length) warnings.push('The token can see no spaces.');
    return {
      site: new URL(parsed.baseUrl).host,
      containers: spaces.map((space, index) => ({
        id: space.key,
        key: space.key,
        name: space.name,
        kind: 'space',
        count: counts[index] ?? null,
      })),
      counts: { spaces: spaces.length, pages: counts.reduce((sum, count) => sum + count, 0) },
      warnings,
    };
  } catch (error) {
    return explainConfluenceError(error);
  }
}

export async function planConfluence(
  sql: SqlClient,
  connection: ImportConnection,
  containers: readonly string[],
  ctx: ImportPlanContext,
): Promise<ImportPlan> {
  const client = confluenceClientFor(connection, ctx);
  try {
    const spaces = (await client.spaces()).filter((space) => containers.includes(space.key));
    const mapped = await ctx.mappings.getMany(
      'space',
      spaces.map((space) => space.key),
    );
    const mappings: ImportMapping[] = [];
    let pages = 0;
    for (const space of spaces) {
      pages += await client.countPages(space.key);
      const key = spaceKeyFrom(space.key);
      const [existing] = await sql<{ id: string }[]>`select id from spaces where key = ${key}`;
      const note = key === space.key ? null : `The key becomes ${key}`;
      mappings.push(
        mapped.has(space.key)
          ? {
              kind: 'space',
              source: space.key,
              action: 'match',
              target: key,
              note: 'Imported before; updated',
            }
          : existing
            ? {
                kind: 'space',
                source: space.key,
                action: 'match',
                target: key,
                note: 'A space with this key exists',
              }
            : { kind: 'space', source: space.key, action: 'create', target: key, note },
      );
    }
    mappings.push({
      kind: 'macro',
      source: 'Macros without a Docs block',
      action: 'report',
      target: null,
      note: 'Kept as labelled blocks with their original markup',
    });
    return { containers: [...containers], counts: { spaces: spaces.length, pages }, mappings };
  } catch (error) {
    return explainConfluenceError(error);
  }
}
