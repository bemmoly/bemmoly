import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  Application,
  ApplicationFacets,
  ApplicationFilters,
  ApplicationsPage,
  DomainsResponse,
  GroupsPage,
  ListApplicationsQuery,
  ListGroupsQuery,
} from '../../../../shared/catalog.ts';
import type { ApplicationRow, DomainRow, GroupRow } from '../../models/catalog.ts';
import { escapeLike } from '../../utils/time.ts';
import {
  authorizePipelines,
  personOf,
  requireDatabase,
  type PipelinesServiceDeps,
} from '../deps.ts';
import { loadDelivery } from './delivery.ts';
import { countFacets } from './facets.ts';
import { applicationOrder, applicationWhere, CATALOG_FROM } from './filters.ts';
import { APPLICATION_COLUMNS, toApplication, toDomain, toGroup } from './present.ts';

/**
 * Domain › Group › Application, read side. Everyone who may use Pipelines may read the whole
 * catalog (the Viewer binding at the organisation is the product's default); the access
 * service narrows actions, never visibility of what exists.
 */
export function createCatalogService(deps: PipelinesServiceDeps) {
  return {
    async domains(ctx: RequestContext): Promise<DomainsResponse> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const rows = await sql<DomainRow[]>`
        select d.id, d.key, d.name, d.description, d.color,
          (select count(*) from pipeline_groups g where g.domain_id = d.id)::int as group_count,
          (select count(*) from pipeline_applications a
            where a.domain_id = d.id and a.archived_at is null)::int as application_count
        from pipeline_domains d
        order by d.position, lower(d.name), d.id`;
      return { items: rows.map(toDomain) };
    },

    async groups(ctx: RequestContext, query: ListGroupsQuery): Promise<GroupsPage> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const after = decodeCursor(query.cursor);
      const rows = await sql<GroupRow[]>`
        select g.id, g.key, g.name, g.description, d.id as domain_id, d.key as domain_key,
          d.name as domain_name, d.color as domain_color,
          (select count(*) from pipeline_applications a
            where a.group_id = g.id and a.archived_at is null)::int as application_count
        from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
        where true
          ${query.domain ? sql`and d.key = ${query.domain}` : sql``}
          ${query.q ? sql`and lower(g.name) like ${`%${escapeLike(query.q.toLowerCase())}%`}` : sql``}
          ${
            after
              ? sql`and (lower(g.name), g.id) > (
                  select lower(name), id from pipeline_groups where id = ${after}::uuid)`
              : sql``
          }
        order by lower(g.name), g.id
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toGroup), nextCursor: page.nextCursor };
    },

    async applications(
      ctx: RequestContext,
      query: ListApplicationsQuery,
    ): Promise<ApplicationsPage> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const me = personOf(ctx.actor);
      const where = applicationWhere(sql, query, me);
      const { after, order } = applicationOrder(sql, query.sort, decodeCursor(query.cursor));
      const [rows, [counts]] = await Promise.all([
        sql<ApplicationRow[]>`
          select ${sql.unsafe(APPLICATION_COLUMNS)} from ${sql.unsafe(CATALOG_FROM)}
          where ${where} ${after}
          ${order}
          limit ${query.limit + 1}`,
        sql<{ total: number; all_count: number }[]>`
          select
            (select count(*) from ${sql.unsafe(CATALOG_FROM)} where ${where})::int as total,
            (select count(*) from pipeline_applications where archived_at is null)::int as all_count`,
      ]);
      const page = toPage(rows, query.limit);
      const delivery = await loadDelivery(
        sql,
        page.rows.map((row) => row.id),
      );
      return {
        items: page.rows.map((row) => toApplication(row, delivery.get(row.id))),
        nextCursor: page.nextCursor,
        total: counts?.total ?? 0,
        all: counts?.all_count ?? 0,
      };
    },

    async facets(ctx: RequestContext, filters: ApplicationFilters): Promise<ApplicationFacets> {
      await authorizePipelines(ctx);
      return countFacets(requireDatabase(deps), filters, personOf(ctx.actor));
    },

    async application(ctx: RequestContext, key: string): Promise<Application> {
      await authorizePipelines(ctx);
      const sql = requireDatabase(deps);
      const [row] = await sql<ApplicationRow[]>`
        select ${sql.unsafe(APPLICATION_COLUMNS)} from ${sql.unsafe(CATALOG_FROM)}
        where a.key = ${key}`;
      if (!row) throw new NotFoundError(`No application called "${key}"`);
      const delivery = await loadDelivery(sql, [row.id]);
      return toApplication(row, delivery.get(row.id));
    },
  };
}

export type CatalogService = ReturnType<typeof createCatalogService>;
