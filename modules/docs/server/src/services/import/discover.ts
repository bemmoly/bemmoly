import type {
  ImportConnection,
  ImportContainerRef,
  ImportPlanContext,
  ImportSourceContext,
  SqlClient,
} from '@bemmoly/core';
import type { ImportContainer, ImportDiscovery, ImportMapping, ImportPlan } from '@bemmoly/shared';
import {
  confluenceClientFor,
  explainConfluenceError,
  parseConfluenceConnection,
  spaceKeyFrom,
} from './connection.ts';

/**
 * Tests the token and lists the spaces, team and personal, without counting their pages
 * (count() does that on demand). Marks what an earlier import made of a space and spaces
 * whose Docs key is already taken by another space.
 */
export async function discoverConfluence(
  sql: SqlClient,
  connection: ImportConnection,
  ctx: ImportPlanContext,
): Promise<ImportDiscovery> {
  const parsed = parseConfluenceConnection(connection);
  const client = confluenceClientFor(connection, ctx);
  try {
    await client.currentUser();
    const spaces = await client.spaces();
    const mapped = await ctx.mappings.getMany(
      'space',
      spaces.map((space) => space.key),
    );
    const targets = await sql<{ id: string; key: string; name: string }[]>`
      select id, key, name from spaces
      where id = any(${[...mapped.values()].map((row) => row.targetId)}::uuid[])`;
    const byId = new Map(targets.map((row) => [row.id, row]));
    const taken = new Map(
      (
        await sql<{ id: string; key: string }[]>`
          select id, key from spaces
          where key = any(${spaces.map((space) => spaceKeyFrom(space.key))}::text[])`
      ).map((row) => [row.key, row.id]),
    );
    const containers = spaces.map((space): ImportContainer => {
      const mapping = mapped.get(space.key);
      const target = mapping ? byId.get(mapping.targetId) : undefined;
      const holder = taken.get(spaceKeyFrom(space.key));
      return {
        id: space.key,
        key: space.key,
        name: space.name,
        kind: 'space',
        count: null,
        type: space.type === 'personal' ? 'Personal' : 'Team',
        lead: null,
        access: 'ok',
        imported: target
          ? { ...target, at: mapping?.updatedAt ?? new Date(0).toISOString() }
          : null,
        keyInUse: holder !== undefined && holder !== target?.id,
      };
    });
    return {
      site: new URL(parsed.baseUrl).host,
      containers,
      counts: { spaces: spaces.length },
      warnings: spaces.length ? [] : ['The token can see no spaces.'],
    };
  } catch (error) {
    return explainConfluenceError(error);
  }
}

/** Current pages per space, by CQL, six spaces at a time. */
export async function countConfluence(
  connection: ImportConnection,
  containers: readonly ImportContainerRef[],
  ctx: ImportSourceContext,
): Promise<Record<string, number>> {
  const client = confluenceClientFor(connection, ctx);
  const counts: Record<string, number> = {};
  try {
    for (let start = 0; start < containers.length; start += 6) {
      const batch = containers.slice(start, start + 6);
      const totals = await Promise.all(batch.map((space) => client.countPages(space.id)));
      batch.forEach((space, index) => (counts[space.id] = totals[index] ?? 0));
    }
    return counts;
  } catch (error) {
    return explainConfluenceError(error);
  }
}

export async function planConfluence(
  sql: SqlClient,
  containers: readonly ImportContainerRef[],
  ctx: ImportPlanContext,
): Promise<ImportPlan> {
  try {
    const spaces = containers.map((container) => ({ key: container.id, count: container.count }));
    const mapped = await ctx.mappings.getMany(
      'space',
      spaces.map((space) => space.key),
    );
    const mappings: ImportMapping[] = [];
    let pages = 0;
    for (const space of spaces) {
      pages += space.count ?? 0;
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
    return {
      containers: spaces.map((space) => space.key),
      counts: { spaces: spaces.length, pages },
      mappings,
    };
  } catch (error) {
    return explainConfluenceError(error);
  }
}
