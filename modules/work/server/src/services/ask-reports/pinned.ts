import type { RequestContext, SqlClient } from '@bemmoly/core';
import { ConflictError, NotFoundError, ValidationError } from '@bemmoly/shared';
import {
  MAX_PINNED_REPORTS,
  reportSpecSchema,
  type CreatePinnedReportBody,
  type PinnedReport,
  type PinnedReportView,
  type ReportResult,
  type ReportSpec,
} from '../../../../shared/ask-reports.ts';
import { actorUserId, iso, requireDatabase } from '../issues/deps.ts';
import { readableProject, runReportSpec } from './run.ts';

/*
 * Pinned reports: a person's own reports on their Reports view, kept as the question and the
 * spec and rebuilt live on every read, so a pin never shows stale numbers and never needs AI
 * again. Running a spec needs no model, which is also how a dashboard widget can show one.
 * A pin is private to its owner; reading it still checks the project as any report does.
 */

interface PinRow {
  id: string;
  project_id: string;
  question: string;
  spec: unknown;
  created_at: Date;
}

export interface PinnedReportsDeps {
  database?: SqlClient;
  now?: () => Date;
}

function ownerOf(ctx: RequestContext): string {
  const userId = actorUserId(ctx);
  if (!userId) throw new ValidationError('Only a person can pin a report');
  return userId;
}

export function createPinnedReportsService(deps: PinnedReportsDeps) {
  const now = () => deps.now?.() ?? new Date();

  const toPin = (row: PinRow, spec: ReportSpec): PinnedReport => ({
    id: row.id,
    projectId: row.project_id,
    question: row.question,
    spec,
    createdAt: iso(row.created_at),
  });

  return {
    /** A spec run now, without AI: the Reports view's pins and, later, dashboard widgets. */
    async run(ctx: RequestContext, ref: string, spec: ReportSpec): Promise<ReportResult> {
      const sql = requireDatabase(deps);
      const project = await readableProject(sql, ctx, ref);
      return runReportSpec(sql, ctx, project.id, spec, now());
    },

    async list(ctx: RequestContext, ref: string): Promise<PinnedReportView[]> {
      const sql = requireDatabase(deps);
      const project = await readableProject(sql, ctx, ref);
      const rows = await sql<PinRow[]>`
        select id, project_id, question, spec, created_at from pinned_reports
        where owner_id = ${ownerOf(ctx)} and project_id = ${project.id}
        order by created_at, id`;
      return Promise.all(
        rows.map(async (row): Promise<PinnedReportView> => {
          // A spec stored by an older release may no longer parse; that pin says so and the
          // rest of the view still draws.
          const parsed = reportSpecSchema.safeParse(row.spec);
          if (!parsed.success) {
            return {
              id: row.id,
              projectId: row.project_id,
              question: row.question,
              spec: row.spec as ReportSpec,
              createdAt: iso(row.created_at),
              result: null,
              error: 'This report can no longer be built. Unpin it and ask again.',
            };
          }
          const result = await runReportSpec(sql, ctx, project.id, parsed.data, now());
          return { ...toPin(row, parsed.data), result, error: null };
        }),
      );
    },

    async create(
      ctx: RequestContext,
      ref: string,
      body: CreatePinnedReportBody,
    ): Promise<PinnedReport> {
      const sql = requireDatabase(deps);
      const project = await readableProject(sql, ctx, ref);
      const owner = ownerOf(ctx);
      const [count] = await sql<{ n: number }[]>`
        select count(*)::int as n from pinned_reports
        where owner_id = ${owner} and project_id = ${project.id}`;
      if ((count?.n ?? 0) >= MAX_PINNED_REPORTS) {
        throw new ConflictError(
          `You have ${MAX_PINNED_REPORTS} pinned reports here. Unpin one to pin another.`,
        );
      }
      const [row] = await sql<PinRow[]>`
        insert into pinned_reports (owner_id, project_id, question, spec)
        values (${owner}, ${project.id}, ${body.question}, ${JSON.stringify(body.spec)}::jsonb)
        returning id, project_id, question, spec, created_at`;
      return toPin(row!, body.spec);
    },

    async remove(ctx: RequestContext, id: string): Promise<void> {
      const rows = await requireDatabase(deps)`
        delete from pinned_reports where id = ${id} and owner_id = ${ownerOf(ctx)}
        returning id`;
      if (rows.length === 0) throw new NotFoundError('That pinned report was not found');
    },
  };
}

export type PinnedReportsService = ReturnType<typeof createPinnedReportsService>;
