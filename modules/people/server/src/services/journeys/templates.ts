import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  CreateJourneyTemplateBody,
  JourneyKind,
  JourneyTemplate,
  UpdateJourneyTemplateBody,
} from '../../../../shared/journeys.ts';
import {
  authorize,
  publishChange,
  recordAudit,
  requireDatabase,
  SETTINGS_CAPABILITY,
  type PeopleServiceDeps,
} from '../common.ts';
import { toTemplate, type TemplateRow } from './rows.ts';

/**
 * The template for a person: of the kind, at their location or any, for their title or any.
 * The most specific wins; among equals, the oldest.
 */
export async function templateFor(
  sql: SqlExecutor,
  kind: JourneyKind,
  person: { locationId: string | null; jobTitle: string | null },
): Promise<JourneyTemplate | null> {
  const [row] = await sql<TemplateRow[]>`
    select * from journey_templates
    where kind = ${kind} and archived_at is null
      and (location_id is null or location_id = ${person.locationId})
      and (job_title is null
        or ${person.jobTitle ?? ''} ilike '%' || job_title || '%')
    order by (location_id is not null)::int + (job_title is not null)::int desc, created_at
    limit 1`;
  return row ? toTemplate(row) : null;
}

/** Onboarding and offboarding templates, kept in Settings › People. */
export function createJourneyTemplates(deps: PeopleServiceDeps) {
  async function byId(sql: SqlExecutor, id: string): Promise<TemplateRow> {
    const [row] = await sql<TemplateRow[]>`select * from journey_templates where id = ${id}`;
    if (!row) throw new NotFoundError('That template does not exist');
    return row;
  }

  return {
    async list(): Promise<JourneyTemplate[]> {
      const sql = requireDatabase(deps);
      const rows = await sql<TemplateRow[]>`
        select * from journey_templates order by archived_at nulls first, kind, name`;
      return rows.map(toTemplate);
    },

    async get(id: string): Promise<JourneyTemplate> {
      return toTemplate(await byId(requireDatabase(deps), id));
    },

    async create(ctx: RequestContext, body: CreateJourneyTemplateBody): Promise<JourneyTemplate> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return sql.begin(async (tx) => {
        const [row] = await tx<TemplateRow[]>`
          insert into journey_templates (name, kind, location_id, job_title, tasks)
          values (${body.name}, ${body.kind}, ${body.locationId ?? null}, ${body.jobTitle ?? null},
            ${JSON.stringify(body.tasks)}::jsonb)
          returning *`;
        const template = toTemplate(row!);
        await recordAudit(
          deps,
          ctx,
          {
            action: 'people.journey_template.created',
            kind: 'journey_template',
            id: template.id,
            after: template,
          },
          tx,
        );
        await publishChange(deps, 'people.settings', [template.id]);
        return template;
      });
    },

    async update(
      ctx: RequestContext,
      id: string,
      body: UpdateJourneyTemplateBody,
    ): Promise<JourneyTemplate> {
      await authorize(ctx, SETTINGS_CAPABILITY);
      const sql = requireDatabase(deps);
      return sql.begin(async (tx) => {
        const before = await byId(tx, id);
        const archived = body.archived ?? before.archived_at !== null;
        const [row] = await tx<TemplateRow[]>`
          update journey_templates set
            name = ${body.name ?? before.name},
            location_id = ${body.locationId === undefined ? before.location_id : body.locationId},
            job_title = ${body.jobTitle === undefined ? before.job_title : body.jobTitle},
            tasks = ${JSON.stringify(body.tasks ?? before.tasks)}::jsonb,
            archived_at = case when ${archived} then coalesce(archived_at, now()) end,
            updated_at = now()
          where id = ${id}
          returning *`;
        const template = toTemplate(row!);
        await recordAudit(
          deps,
          ctx,
          {
            action: 'people.journey_template.updated',
            kind: 'journey_template',
            id,
            before: toTemplate(before),
            after: template,
          },
          tx,
        );
        await publishChange(deps, 'people.settings', [id]);
        return template;
      });
    },
  };
}

export type JourneyTemplates = ReturnType<typeof createJourneyTemplates>;
