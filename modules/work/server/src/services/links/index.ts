import type { RequestContext } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import type { CreateIssueLinkBody, IssueLink } from '../../../../shared/links-labels.ts';
import { createIssueLinkBodySchema } from '../../../../shared/links-labels.ts';
import { iso, projectResource, requireDatabase, type IssueServiceDeps } from '../issues/deps.ts';
import { publishIssueChange } from '../issues/notify.ts';
import { loadIssueById, loadIssueByKey, toIssue } from '../issues/rows.ts';

/*
 * One row per link, read from both ends: "blocked by" is the blocks row
 * seen from its target, never a second row. No self links, no repeats of
 * the same pair and kind in either direction.
 */

interface LinkRow {
  id: string;
  source_id: string;
  target_id: string;
  kind: IssueLink['kind'];
  created_by: string | null;
  created_at: Date | string;
}

const COLUMNS = 'id, source_id, target_id, kind, created_by, created_at';

const toLink = (row: LinkRow): IssueLink => ({
  id: row.id,
  sourceId: row.source_id,
  targetId: row.target_id,
  kind: row.kind,
  createdBy: row.created_by,
  createdAt: iso(row.created_at),
});

export function createLinksService(deps: IssueServiceDeps) {
  return {
    async list(ctx: RequestContext, key: string): Promise<IssueLink[]> {
      const sql = requireDatabase(deps);
      const issue = await loadIssueByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(issue.project_id));
      const rows = await sql<LinkRow[]>`
        select ${sql.unsafe(COLUMNS)} from issue_links
        where source_id = ${issue.id} or target_id = ${issue.id}
        order by id`;
      return rows.map(toLink);
    },

    async create(ctx: RequestContext, key: string, input: CreateIssueLinkBody): Promise<IssueLink> {
      const body = createIssueLinkBodySchema.parse(input);
      const sql = requireDatabase(deps);
      const issue = await loadIssueByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(issue.project_id));
      if (body.targetId === issue.id) throw new ValidationError('An issue cannot link to itself');
      const other = await loadIssueById(sql, body.targetId);
      if (other.project_id !== issue.project_id) {
        await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(other.project_id));
      }
      const [sourceId, targetId] = body.inverse ? [other.id, issue.id] : [issue.id, other.id];
      const created = await sql.begin(async (tx) => {
        const existing = await tx<{ id: string }[]>`
          select id from issue_links
          where kind = ${body.kind}
            and ((source_id = ${sourceId} and target_id = ${targetId})
              or (source_id = ${targetId} and target_id = ${sourceId}))`;
        if (existing.length > 0) {
          throw new ConflictError(`${issue.key} is already linked to ${other.key} this way`);
        }
        const [row] = await tx<LinkRow[]>`
          insert into issue_links (source_id, target_id, kind, created_by)
          values (${sourceId}, ${targetId}, ${body.kind}, ${ctx.actor.userId ?? ctx.actor.id})
          returning ${tx.unsafe(COLUMNS)}`;
        if (!row) throw new NotFoundError('The link was not stored');
        await publishIssueChange(deps, tx, toIssue(issue), { board: body.kind === 'blocks' });
        await publishIssueChange(deps, tx, toIssue(other), { board: body.kind === 'blocks' });
        return toLink(row);
      });
      return created as IssueLink;
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const sql = requireDatabase(deps);
      const [row] = await sql<LinkRow[]>`
        select ${sql.unsafe(COLUMNS)} from issue_links where id = ${id}`;
      if (!row) throw new NotFoundError('The link was not found');
      const source = await loadIssueById(sql, row.source_id, { includeDeleted: true });
      await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(source.project_id));
      const target = await loadIssueById(sql, row.target_id, { includeDeleted: true });
      await sql.begin(async (tx) => {
        await tx`delete from issue_links where id = ${id}`;
        await publishIssueChange(deps, tx, toIssue(source), { board: row.kind === 'blocks' });
        await publishIssueChange(deps, tx, toIssue(target), { board: row.kind === 'blocks' });
      });
    },
  };
}

export type LinksService = ReturnType<typeof createLinksService>;
