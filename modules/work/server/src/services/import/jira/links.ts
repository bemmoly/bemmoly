import type { ImportMappingRow, ImportRunContext, SqlClient } from '@bemmoly/core';

/*
 * Parents and links, after every issue of the run exists: an issue may point at one written
 * later in the run, or in another project. What each issue points at was kept on its mapping
 * when it was written, so this pass resumes and re-runs from the mappings alone. A link to an
 * issue that was not imported is reported.
 */

interface IssueMeta {
  key?: string;
  projectId?: string;
  parent?: string | null;
  epicKey?: string | null;
  links?: { to: string; type: string }[];
}

const kindOf = (type: string): 'blocks' | 'duplicates' | 'relates' =>
  type.includes('block') ? 'blocks' : type.includes('duplicat') ? 'duplicates' : 'relates';

export async function writeLinks(
  sql: SqlClient,
  projectIds: ReadonlySet<string>,
  ctx: ImportRunContext,
): Promise<void> {
  const all = await ctx.mappings.all('issue');
  const byKey = new Map<string, string>();
  for (const mapped of all.values()) {
    const key = (mapped.meta as IssueMeta).key;
    if (key) byKey.set(key, mapped.targetId);
  }
  const mine = [...all.entries()].filter(([, mapped]) =>
    projectIds.has(String((mapped.meta as IssueMeta).projectId)),
  );
  await ctx.progress.phase('Links and parents', mine.length);
  const parents: { id: string; parent: string }[] = [];
  const links: { source: string; target: string; kind: string }[] = [];
  const target = (sourceId: string): ImportMappingRow | undefined => all.get(sourceId);
  for (const [, mapped] of mine) {
    const meta = mapped.meta as IssueMeta;
    const parent =
      (meta.parent ? target(meta.parent)?.targetId : undefined) ??
      (meta.epicKey ? byKey.get(meta.epicKey) : undefined);
    if (parent && parent !== mapped.targetId) parents.push({ id: mapped.targetId, parent });
    else if (meta.parent || meta.epicKey)
      ctx.report.skip('link', meta.key ?? mapped.targetId, 'Its parent was not imported');
    for (const link of meta.links ?? []) {
      const to = target(link.to)?.targetId;
      if (!to) {
        ctx.report.skip(
          'link',
          meta.key ?? mapped.targetId,
          'It links to an issue that was not imported',
        );
        continue;
      }
      if (to !== mapped.targetId)
        links.push({ source: mapped.targetId, target: to, kind: kindOf(link.type) });
    }
  }
  for (let start = 0; start < Math.max(parents.length, links.length); start += 1000) {
    const parentChunk = parents.slice(start, start + 1000);
    const linkChunk = links.slice(start, start + 1000);
    if (parentChunk.length) {
      await sql`
        update issues i set parent_id = p.parent, updated_at = i.updated_at
        from jsonb_to_recordset(${JSON.stringify(parentChunk)}::jsonb) as p(id uuid, parent uuid)
        where i.id = p.id and i.parent_id is distinct from p.parent`;
    }
    if (linkChunk.length) {
      const inserted = await sql`
        insert into issue_links (source_id, target_id, kind, created_by)
        select l.source, l.target, l.kind, ${ctx.actorUserId}::uuid
        from jsonb_to_recordset(${JSON.stringify(linkChunk)}::jsonb) as l(source uuid, target uuid, kind text)
        on conflict do nothing`;
      ctx.report.count('links', 'created', inserted.count);
    }
    await ctx.progress.advance(Math.max(parentChunk.length, linkChunk.length));
  }
  ctx.report.count('parents', 'updated', parents.length);
}
