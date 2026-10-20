import type { SqlExecutor } from '@bemmoly/core';

/*
 * An epic's owner is its Owner field (the `owner` person field the default scheme puts on
 * epics), so it is a setting of the epic, not a rule: an issue added to the epic, when it is
 * created or moved in, takes the owner as its assignee unless somebody is already on it. It is
 * written as the create or the update's own assigneeId, so history, the assignment notice and
 * the field_changed event all see it as the change it is.
 */

/** The custom field that names an epic's owner. */
export const EPIC_OWNER_FIELD = 'owner';

/**
 * The owner of the epic an issue is joining, or null when the parent is no epic, has no owner,
 * or names somebody who is no longer an active person.
 */
export async function epicOwnerOf(
  tx: SqlExecutor,
  projectId: string,
  parentId: string | null | undefined,
): Promise<string | null> {
  if (!parentId) return null;
  const [row] = await tx<{ id: string }[]>`
    select u.id from issues e
    join issue_types t on t.id = e.type_id and t.level = 'epic'
    join users u on u.id::text = e.custom_fields ->> ${EPIC_OWNER_FIELD}
    where e.id = ${parentId} and e.project_id = ${projectId} and e.deleted_at is null
      and u.status = 'active'`;
  return row?.id ?? null;
}
