import type {
  EntityLookup,
  EntitySummary,
  ModuleContext,
  RequestContext,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { accessibleProjectIds, projectResource } from '../issues/deps.ts';
import { issuePath } from '../issues/notify.ts';

/*
 * Work in the kernel's reference registries, so other modules can name issues
 * without importing Work: the entity "issue" (by key or id, with what an
 * embed shows) and the reference source "work.issue" (issues whose
 * description links a record, for a page's "Referenced in"). Every answer
 * given for a person keeps to the projects where they may view issues.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IssueEntityRow {
  id: string;
  key: string;
  title: string;
  project_id: string;
  priority: string;
  status: string | null;
  status_category: string | null;
  status_color: string | null;
  type_key: string | null;
  type_name: string | null;
  type_icon: string | null;
  type_color: string | null;
}

const ENTITY_COLUMNS = `i.id, i.key, i.title, i.project_id, i.priority,
  s.name as status, s.category as status_category, s.color as status_color,
  t.key as type_key, t.name as type_name, t.icon as type_icon, t.color as type_color`;

const toEntity = (row: IssueEntityRow): EntitySummary => ({
  kind: 'issue',
  id: row.id,
  key: row.key,
  title: row.title,
  path: issuePath(row.key),
  data: {
    projectId: row.project_id,
    priority: row.priority,
    status: row.status
      ? { name: row.status, category: row.status_category, color: row.status_color }
      : null,
    type: row.type_key
      ? { key: row.type_key, name: row.type_name, icon: row.type_icon, color: row.type_color }
      : null,
  },
});

async function issuesByRef(sql: SqlExecutor, refs: readonly EntityLookup[]) {
  const ids = refs.flatMap((ref) => ('id' in ref && UUID.test(ref.id) ? [ref.id] : []));
  const keys = refs.flatMap((ref) => ('key' in ref ? [ref.key.trim().toUpperCase()] : []));
  if (ids.length === 0 && keys.length === 0) return [];
  return sql<IssueEntityRow[]>`
    select ${sql.unsafe(ENTITY_COLUMNS)}
    from issues i
    left join workflow_statuses s on s.id = i.status_id
    left join issue_types t on t.id = i.type_id
    where i.deleted_at is null and (i.id = any(${ids}::uuid[]) or i.key = any(${keys}::text[]))`;
}

/** The rows the person may view: one capability check per project, not per issue. */
async function viewable(ctx: RequestContext, rows: readonly IssueEntityRow[]) {
  const projects = [...new Set(rows.map((row) => row.project_id))];
  const allowed = new Set<string>();
  await Promise.all(
    projects.map(async (projectId) => {
      if (await ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(projectId))) {
        allowed.add(projectId);
      }
    }),
  );
  return rows.filter((row) => allowed.has(row.project_id));
}

export function createIssueReferences(database: SqlClient | undefined) {
  const sql = () => database;
  return {
    async resolve(ref: EntityLookup): Promise<EntitySummary | null> {
      const db = sql();
      if (!db) return null;
      const [row] = await issuesByRef(db, [ref]);
      return row ? toEntity(row) : null;
    },

    async resolveMany(refs: readonly EntityLookup[], ctx?: RequestContext) {
      const db = sql();
      if (!db) return [];
      const rows = await issuesByRef(db, refs);
      return (ctx ? await viewable(ctx, rows) : rows).map(toEntity);
    },

    async canView(ctx: RequestContext, id: string): Promise<boolean> {
      const db = sql();
      if (!db || !UUID.test(id)) return false;
      const [row] = await db<{ project_id: string }[]>`
        select project_id from issues where id = ${id} and deleted_at is null`;
      return row
        ? ctx.authz.can(ctx.actor, 'work.issue.view', projectResource(row.project_id))
        : false;
    },

    /** Issues whose description links the page; other targets have none yet. */
    async referencesTo(ctx: RequestContext, target: { kind: string; id: string }) {
      const db = sql();
      if (!db || target.kind !== 'page' || !UUID.test(target.id)) return [];
      const projects = await accessibleProjectIds(ctx, db);
      const rows = await db<IssueEntityRow[]>`
        select ${db.unsafe(ENTITY_COLUMNS)}
        from issues i
        left join workflow_statuses s on s.id = i.status_id
        left join issue_types t on t.id = i.type_id
        where i.deleted_at is null
          and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
          and i.description is not null
          and jsonb_path_exists(i.description,
            '$.** ? (@.type == "pageLink" && @.attrs.pageId == $page)',
            jsonb_build_object('page', ${target.id}::text))
        order by i.updated_at desc, i.id
        limit 100`;
      return (await viewable(ctx, rows)).map(toEntity);
    },
  };
}

/** One line in module.ts: issues for other modules, and the issues that link their records. */
export function registerWorkReferences(
  ctx: Pick<ModuleContext, 'entities' | 'links'>,
  database: SqlClient | undefined,
): void {
  const references = createIssueReferences(database);
  ctx.entities.add({
    kind: 'issue',
    renderer: 'work.issue',
    resolve: (ref) => references.resolve(ref),
    resolveMany: (refs, requestCtx) => references.resolveMany(refs, requestCtx),
    canView: (requestCtx, id) => references.canView(requestCtx, id),
  });
  ctx.links.addReferenceSource({
    kind: 'work.issue',
    label: 'Issues',
    referencesTo: (requestCtx, target) => references.referencesTo(requestCtx, target),
  });
}
