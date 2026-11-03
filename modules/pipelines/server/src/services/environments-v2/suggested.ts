import type { SqlExecutor } from '@bemmoly/core';
import type { z } from 'zod';
import type { applySuggestedSetupBodySchema } from '../../../../shared/environments-v2.ts';
import type { ApprovalGroupRef } from '../../../../shared/roles.ts';
import { insertEnvironment } from './writes.ts';

/*
 * The suggested setup, once the person confirmed it (product rule 1: a suggestion only fills a
 * form). Environments go on the path in the order given; an approval names its group, which is
 * made empty when no group has that name, so the person adds the people themselves.
 */

type ApplySuggested = z.infer<typeof applySuggestedSetupBodySchema>;

async function groupFor(
  sql: SqlExecutor,
  name: string,
  createdBy: string | null,
  made: ApprovalGroupRef[],
): Promise<string> {
  const [existing] = await sql<{ id: string }[]>`
    select id from pipeline_approval_groups where lower(name) = lower(${name})`;
  if (existing) return existing.id;
  const [created] = await sql<ApprovalGroupRef[]>`
    insert into pipeline_approval_groups (name, created_by) values (${name}, ${createdBy})
    returning id, name`;
  if (!created) throw new Error('insert returned nothing');
  made.push(created);
  return created.id;
}

/** Writes every environment and group of the setup; answers the groups it made. */
export async function applySuggested(
  sql: SqlExecutor,
  body: ApplySuggested,
  createdBy: string | null,
): Promise<ApprovalGroupRef[]> {
  const made: ApprovalGroupRef[] = [];
  for (const environment of body.environments) {
    const approvalRule = environment.approval
      ? {
          steps: [
            {
              group: await groupFor(sql, environment.approval.groupName, createdBy, made),
              count: environment.approval.count,
              when: 'always' as const,
            },
          ],
        }
      : null;
    await insertEnvironment(sql, {
      name: environment.name,
      key: environment.key,
      ...(environment.project ? { project: environment.project } : {}),
      deployers: null,
      approvalRule,
      window: environment.window,
      versionsAllowed: environment.versionsAllowed,
    });
  }
  return made;
}
