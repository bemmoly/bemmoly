import type { SqlExecutor } from '@bemmoly/core';

/*
 * Override copies the org default issue types or fields into the project,
 * each copy pointing at its origin; reset drops the copies. Issues follow:
 * their type moves to the copy and back, and custom field values, keyed by
 * field key, stay on the issue either way.
 */

/** Types with their create-form layouts, which use the project's field copies when it has them. */
export async function overrideTypes(tx: SqlExecutor, projectId: string): Promise<void> {
  await tx`
    insert into issue_types (project_id, origin_id, key, name, description, icon, color, level,
      position)
    select ${projectId}, id, key, name, description, icon, color, level, position
    from issue_types where project_id is null`;
  await tx`
    insert into issue_type_fields (issue_type_id, field_id, required, on_card, position)
    select copy.id, coalesce(own.id, l.field_id), l.required, l.on_card, l.position
    from issue_type_fields l
    join issue_types copy on copy.origin_id = l.issue_type_id and copy.project_id = ${projectId}
    left join fields own on own.origin_id = l.field_id and own.project_id = ${projectId}`;
  await tx`
    update issues i set type_id = copy.id
    from issue_types copy
    where copy.project_id = ${projectId} and copy.origin_id = i.type_id
      and i.project_id = ${projectId}`;
}

/**
 * Issues go back to each copy's origin; a type added on the project goes to
 * the org type with its key, else the first org type of its level, else the
 * first org type, so no issue is left without a type.
 */
export async function resetTypes(tx: SqlExecutor, projectId: string): Promise<void> {
  await tx`
    update issues i set type_id = coalesce(
        t.origin_id,
        (select o.id from issue_types o where o.project_id is null and o.key = t.key),
        (select o.id from issue_types o where o.project_id is null and o.level = t.level
          order by o.position, o.id limit 1),
        (select o.id from issue_types o where o.project_id is null
          order by o.position, o.id limit 1))
    from issue_types t
    where t.id = i.type_id and t.project_id = ${projectId}`;
  await tx`delete from issue_types where project_id = ${projectId}`;
}

/** Fields, with the project's own type layouts re-pointed at the copies. */
export async function overrideFields(tx: SqlExecutor, projectId: string): Promise<void> {
  await tx`
    insert into fields (project_id, origin_id, key, name, kind, options, filterable, ai_fill)
    select ${projectId}, id, key, name, kind, options, filterable, ai_fill
    from fields where project_id is null`;
  await tx`
    update issue_type_fields l set field_id = own.id, updated_at = now()
    from fields own, issue_types t
    where own.project_id = ${projectId} and own.origin_id = l.field_id
      and t.id = l.issue_type_id and t.project_id = ${projectId}`;
}

/** Layout rows move back to the origin field; rows for fields only the project had go with them. */
export async function resetFields(tx: SqlExecutor, projectId: string): Promise<void> {
  await tx`
    delete from issue_type_fields l using fields own
    where l.field_id = own.id and own.project_id = ${projectId}
      and exists (select 1 from issue_type_fields twin
        where twin.issue_type_id = l.issue_type_id and twin.field_id = own.origin_id)`;
  await tx`
    update issue_type_fields l set field_id = own.origin_id, updated_at = now()
    from fields own
    where l.field_id = own.id and own.project_id = ${projectId} and own.origin_id is not null`;
  await tx`delete from fields where project_id = ${projectId}`;
}
