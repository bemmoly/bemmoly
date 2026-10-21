import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { CapabilityName } from '@bemmoly/shared';
import { WORK_ACTION_NAMES, type ProjectPermissions } from '../../../../shared/actions.ts';
import { projectByKey, projectResource } from './rows.ts';

/**
 * The Work actions the person asking holds in one project, after their project role, so the
 * web hides or disables what the server would refuse. The server still checks every write;
 * this is a hint, never the gate. Reading it needs issue view there.
 */
export async function projectPermissions(
  ctx: RequestContext,
  sql: SqlExecutor,
  ref: string,
): Promise<ProjectPermissions> {
  const project = await projectByKey(sql, ref);
  const resource = projectResource(project.id);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', resource);
  const held = await Promise.all(
    WORK_ACTION_NAMES.map((action) => ctx.authz.can(ctx.actor, action as CapabilityName, resource)),
  );
  return { projectId: project.id, actions: WORK_ACTION_NAMES.filter((_, index) => held[index]) };
}
