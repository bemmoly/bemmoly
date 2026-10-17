import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError } from '@bemmoly/shared';
import type { Domain, Group } from '../../../../shared/catalog.ts';
import type {
  CreateDomainBody,
  CreateGroupBody,
  UpdateDomainBody,
  UpdateGroupBody,
} from '../../../../shared/catalog-writes.ts';
import type { DomainRow, GroupRow } from '../../models/catalog.ts';
import { toDomain, toGroup } from '../catalog/present.ts';
import type { AccessEngine } from '../access/index.ts';
import { domainByKey, publishCatalog } from './lookups.ts';

/*
 * Domains and groups: the catalog's tree. Domains are the organisation's shape, so only a
 * Platform admin changes them; a group is managed by whoever maintains its domain. Neither
 * is removed while something still sits in it.
 */

async function readDomain(sql: SqlExecutor, id: string): Promise<Domain> {
  const [row] = await sql<DomainRow[]>`
    select d.id, d.key, d.name, d.description, d.color,
      (select count(*) from pipeline_groups g where g.domain_id = d.id)::int as group_count,
      (select count(*) from pipeline_applications a
        where a.domain_id = d.id and a.archived_at is null)::int as application_count
    from pipeline_domains d where d.id = ${id}::uuid`;
  if (!row) throw new NotFoundError('The domain was removed');
  return toDomain(row);
}

async function readGroup(sql: SqlExecutor, id: string): Promise<Group> {
  const [row] = await sql<GroupRow[]>`
    select g.id, g.key, g.name, g.description, d.id as domain_id, d.key as domain_key,
      d.name as domain_name, d.color as domain_color,
      (select count(*) from pipeline_applications a
        where a.group_id = g.id and a.archived_at is null)::int as application_count
    from pipeline_groups g join pipeline_domains d on d.id = g.domain_id
    where g.id = ${id}::uuid`;
  if (!row) throw new NotFoundError('No such group');
  return toGroup(row);
}

export function createStructureWrites(sql: () => SqlClient, access: AccessEngine) {
  return {
    async createDomain(ctx: RequestContext, body: CreateDomainBody): Promise<Domain> {
      await access.authorizeAction(ctx, 'platform', {});
      const id = await sql().begin(async (tx) => {
        const [row] = await tx<{ id: string }[]>`
          insert into pipeline_domains (key, name, description, color, position)
          values (${body.key}, ${body.name}, ${body.description ?? null}, ${body.color ?? 'epic-1'},
            (select coalesce(max(position), 0) + 1 from pipeline_domains))
          on conflict (key) do nothing returning id`;
        if (!row) throw new ConflictError(`A domain called "${body.key}" already exists`);
        await publishCatalog(tx, [], body.key);
        return row.id;
      });
      return readDomain(sql(), id);
    },

    async updateDomain(ctx: RequestContext, key: string, body: UpdateDomainBody): Promise<Domain> {
      const domain = await domainByKey(sql(), key);
      await access.authorizeAction(ctx, 'platform', {});
      await sql().begin(async (tx) => {
        await tx`
          update pipeline_domains set
            name = coalesce(${body.name ?? null}, name),
            description = ${body.description === undefined ? tx`description` : body.description},
            color = coalesce(${body.color ?? null}, color), updated_at = now()
          where id = ${domain.id}::uuid`;
        await publishCatalog(tx, [], key);
      });
      return readDomain(sql(), domain.id);
    },

    async removeDomain(ctx: RequestContext, key: string): Promise<void> {
      const domain = await domainByKey(sql(), key);
      await access.authorizeAction(ctx, 'platform', {});
      await sql().begin(async (tx) => {
        const [used] = await tx<{ groups: number }[]>`
          select count(*)::int as groups from pipeline_groups where domain_id = ${domain.id}::uuid`;
        if ((used?.groups ?? 0) > 0) {
          throw new ConflictError(`${domain.name} still has groups. Move or remove them first.`);
        }
        await tx`delete from pipeline_domains where id = ${domain.id}::uuid`;
        await publishCatalog(tx, [], key);
      });
    },

    async createGroup(ctx: RequestContext, body: CreateGroupBody): Promise<Group> {
      const domain = await domainByKey(sql(), body.domain);
      await access.authorizeAction(ctx, 'manage', { scope: { kind: 'domain', id: domain.id } });
      const id = await sql().begin(async (tx) => {
        const [row] = await tx<{ id: string }[]>`
          insert into pipeline_groups (domain_id, key, name, description)
          values (${domain.id}::uuid, ${body.key}, ${body.name}, ${body.description ?? null})
          on conflict (domain_id, key) do nothing returning id`;
        if (!row)
          throw new ConflictError(`${domain.name} already has a group called "${body.key}"`);
        await publishCatalog(tx, [], domain.key);
        return row.id;
      });
      return readGroup(sql(), id);
    },

    async updateGroup(ctx: RequestContext, id: string, body: UpdateGroupBody): Promise<Group> {
      const group = await readGroup(sql(), id);
      await access.authorizeAction(ctx, 'manage', { scope: { kind: 'group', id } });
      const target = body.domain ? await domainByKey(sql(), body.domain) : null;
      if (target && target.id !== group.domain.id) {
        // Moving a group moves its applications: whoever maintains the new domain must agree.
        await access.authorizeAction(ctx, 'manage', { scope: { kind: 'domain', id: target.id } });
      }
      await sql().begin(async (tx) => {
        const domainId = target?.id ?? group.domain.id;
        const clash = await tx`
          select 1 from pipeline_groups
          where domain_id = ${domainId}::uuid and key = ${group.key} and id <> ${id}::uuid`;
        if (clash.length > 0)
          throw new ConflictError(`That domain already has a "${group.key}" group`);
        await tx`
          update pipeline_groups set
            name = coalesce(${body.name ?? null}, name), domain_id = ${domainId}::uuid,
            description = ${body.description === undefined ? tx`description` : body.description},
            updated_at = now()
          where id = ${id}::uuid`;
        await tx`update pipeline_applications set domain_id = ${domainId}::uuid, updated_at = now()
          where group_id = ${id}::uuid and domain_id <> ${domainId}::uuid`;
        await publishCatalog(tx, [], target?.key ?? group.domain.key);
      });
      return readGroup(sql(), id);
    },

    async removeGroup(ctx: RequestContext, id: string): Promise<void> {
      const group = await readGroup(sql(), id);
      await access.authorizeAction(ctx, 'manage', { scope: { kind: 'group', id } });
      await sql().begin(async (tx) => {
        const [used] = await tx<{ applications: number }[]>`
          select count(*)::int as applications from pipeline_applications
          where group_id = ${id}::uuid`;
        if ((used?.applications ?? 0) > 0) {
          throw new ConflictError(`${group.name} still has applications. Move them first.`);
        }
        await tx`delete from pipeline_groups where id = ${id}::uuid`;
        await publishCatalog(tx, [], group.domain.key);
      });
    },
  };
}
