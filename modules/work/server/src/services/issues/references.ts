import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';

/** The rows an issue names that belong to one project. */
export interface ProjectReferences {
  typeId?: string | undefined;
  labelIds?: readonly string[] | undefined;
  fixVersionId?: string | null | undefined;
  componentId?: string | null | undefined;
}

/**
 * Types (or the org defaults), labels, versions and components are listed,
 * renamed and deleted per project, so an issue may only name its own
 * project's. The foreign keys accept any row; this is the check they cannot
 * make.
 */
export async function assertOwnReferences(
  tx: SqlExecutor,
  projectId: string,
  refs: ProjectReferences,
): Promise<void> {
  if (refs.typeId) {
    const [row] = await tx<{ id: string }[]>`
      select id from issue_types
      where id = ${refs.typeId} and (project_id = ${projectId} or project_id is null)`;
    if (!row) throw new ValidationError('The issue type does not belong to this project');
  }
  const labelIds = [...new Set(refs.labelIds ?? [])];
  if (labelIds.length > 0) {
    const rows = await tx<{ id: string }[]>`
      select id from labels where project_id = ${projectId} and id = any(${labelIds}::uuid[])`;
    if (rows.length !== labelIds.length) {
      throw new ValidationError('A label does not belong to this project', {
        details: { labelIds: labelIds.filter((id) => !rows.some((row) => row.id === id)) },
      });
    }
  }
  if (refs.fixVersionId) {
    const [row] = await tx<{ id: string }[]>`
      select id from versions where id = ${refs.fixVersionId} and project_id = ${projectId}`;
    if (!row) throw new ValidationError('The fix version does not belong to this project');
  }
  if (refs.componentId) {
    const [row] = await tx<{ id: string }[]>`
      select id from components where id = ${refs.componentId} and project_id = ${projectId}`;
    if (!row) throw new ValidationError('The component does not belong to this project');
  }
}
