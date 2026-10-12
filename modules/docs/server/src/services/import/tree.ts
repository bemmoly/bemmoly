import type { ContainerMemberships, ImportRunContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { SPACE_ADMIN_ROLE_KEY } from '../../../../shared/members.ts';
import type { ConfluenceClient, ConfluenceSpace } from '../../clients/confluence.ts';
import { rankAmongSiblings } from '../pages/rank.ts';
import { spaceKeyFrom } from './connection.ts';

/*
 * The space and its page tree, before any body is written: every page row exists (parents
 * before children) so a body can link to any page of the import. A page an earlier run made
 * is found through its mapping and keeps its place; new pages go at the end of their parent.
 * A page and its mapping commit together, so a run that stops between pages never leaves a
 * page its retry cannot find.
 */

export interface TreeDeps {
  sql: SqlClient;
  memberships?: ContainerMemberships;
}

export interface TreePage {
  id: string;
  title: string;
  created: boolean;
}

export async function ensureSpace(deps: TreeDeps, space: ConfluenceSpace, ctx: ImportRunContext) {
  const { sql } = deps;
  const target = ctx.targets.get(space.key);
  if (target?.mode === 'existing' && target.id) {
    const [row] = await sql<{ id: string; key: string }[]>`
      select id, key from spaces where id = ${target.id}`;
    if (!row) throw new Error(`The Docs space chosen for ${space.key} no longer exists`);
    await ctx.mappings.set('space', space.key, row.id);
    ctx.report.count('spaces', 'updated');
    return row;
  }
  const mapped = await ctx.mappings.get('space', space.key);
  if (mapped) {
    const [row] = await sql<{ id: string; key: string }[]>`
      select id, key from spaces where id = ${mapped.targetId}`;
    // The space an earlier run of this import made is its own, under the key it asked for.
    if (row && (target?.mode !== 'create' || row.key === target.key)) return row;
  }
  const key = target?.mode === 'create' ? target.key : spaceKeyFrom(space.key);
  if (key !== space.key) ctx.report.warn(`Space ${space.key} is ${key} here.`);
  const row = await sql.begin(async (tx) => {
    const [created] = await tx<{ id: string; key: string; inserted: boolean }[]>`
      insert into spaces (key, name, description, created_by)
      values (${key}, ${space.name.slice(0, 120) || key},
        ${space.description?.plain?.value?.slice(0, 2000) || null}, ${ctx.actorUserId}::uuid)
      on conflict (key) do nothing
      returning id, key, true as inserted`;
    // Never a silent merge into a space that happens to hold the key.
    if (!created) {
      throw new Error(
        `${key} is taken by another Docs space; pick another key or that space in Options`,
      );
    }
    if (created.inserted && deps.memberships && ctx.actorUserId) {
      const roles = await deps.memberships.roles(tx);
      const admin = roles.find((role) => role.key === SPACE_ADMIN_ROLE_KEY);
      await deps.memberships.add(
        'space',
        created.id,
        { userIds: [ctx.actorUserId], ...(admin ? { roleId: admin.id } : {}) },
        tx,
      );
    }
    return created;
  });
  ctx.report.count('spaces', row.inserted ? 'created' : 'updated');
  await ctx.mappings.set('space', space.key, row.id);
  return { id: row.id, key: row.key };
}

async function insertPage(
  sql: SqlExecutor,
  spaceId: string,
  title: string,
  parent: { id: string; path: string } | null,
  userId: string | null,
): Promise<{ id: string; path: string }> {
  const position = await rankAmongSiblings(sql, { spaceId, parentId: parent?.id ?? null });
  const [row] = await sql<{ id: string; path: string }[]>`
    insert into pages (id, space_id, parent_id, position, path, title, status, owner_id,
      created_by, updated_by, published_at)
    select g.id, ${spaceId}, ${parent?.id ?? null}::uuid, ${position},
      ${parent?.path ?? '/'} || g.id::text || '/', ${title.slice(0, 500)}, 'published',
      ${userId}::uuid, ${userId}::uuid, ${userId}::uuid, now()
    from (select uuidv7() as id) g
    returning id, path`;
  if (!row) throw new Error('An imported page was not stored');
  return row;
}

/** Every current page of the space as a row; returns Confluence id to page. */
export async function writeTree(
  deps: TreeDeps,
  client: ConfluenceClient,
  space: { sourceKey: string; id: string },
  ctx: ImportRunContext,
): Promise<Map<string, TreePage>> {
  const listed: { id: string; title: string; ancestors: string[] }[] = [];
  for (let start: number | null = 0; start !== null;) {
    const page = await client.pages(space.sourceKey, start, false);
    for (const item of page.results) {
      listed.push({
        id: item.id,
        title: item.title,
        ancestors: (item.ancestors ?? []).map((a) => a.id),
      });
    }
    start = page.next;
  }
  await ctx.progress.phase(`Page tree of ${space.sourceKey}`, listed.length);
  listed.sort((a, b) => a.ancestors.length - b.ancestors.length);
  const known = await ctx.mappings.getMany(
    'page',
    listed.map((page) => page.id),
  );
  const live = new Map(
    (
      await deps.sql<{ id: string; path: string }[]>`
        select id, path from pages
        where id = any(${[...known.values()].map((mapped) => mapped.targetId)}::uuid[])
          and deleted_at is null`
    ).map((row) => [row.id, row]),
  );
  const tree = new Map<string, TreePage & { path: string }>();
  for (const page of listed) {
    const mappedId = known.get(page.id)?.targetId;
    const existing = mappedId ? live.get(mappedId) : undefined;
    if (existing) {
      tree.set(page.id, {
        id: existing.id,
        path: existing.path,
        title: page.title,
        created: false,
      });
    } else {
      const parentId = [...page.ancestors].reverse().find((id) => tree.has(id));
      const parent = parentId ? tree.get(parentId)! : null;
      const row = await deps.sql.begin(async (tx) => {
        const inserted = await insertPage(tx, space.id, page.title, parent, ctx.actorUserId);
        await ctx.mappings.set('page', page.id, inserted.id, { spaceKey: space.sourceKey }, tx);
        return inserted;
      });
      tree.set(page.id, { id: row.id, path: row.path, title: page.title, created: true });
    }
    await ctx.progress.advance();
  }
  return tree;
}
