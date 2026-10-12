import type {
  ImportConnection,
  ImportContainerRef,
  ImportPlanContext,
  SqlClient,
} from '@bemmoly/core';
import type { ImportMapping, ImportPlan } from '@bemmoly/shared';
import type { JiraField, JiraIssueType, JiraStatus } from '../../../clients/jira.ts';
import { explainJiraError, jiraClientFor } from './connection.ts';
import { inBatches } from './discover.ts';
import {
  builtInOf,
  fieldKindOf,
  matchIssueType,
  projectKeyFrom,
  workFields,
  workStatuses,
  workTypes,
} from './schema.ts';

/**
 * Projects whose types and statuses are read for the plan; on a larger choice the rest are
 * mapped the same way when the run reaches them.
 */
export const PLAN_DETAIL_LIMIT = 50;

const mapping = (
  kind: string,
  source: string,
  action: ImportMapping['action'],
  target: string | null,
  note: string | null = null,
): ImportMapping => ({ kind, source, action, target, note });

function planFields(fields: readonly JiraField[], existing: { name: string }[]): ImportMapping[] {
  const names = new Set(existing.map((field) => field.name.toLowerCase()));
  return fields
    .filter((field) => field.custom)
    .map((field) => {
      const builtIn = builtInOf(field);
      if (builtIn)
        return mapping(
          'field',
          field.name,
          'match',
          builtIn === 'epic' ? 'Parent' : builtIn === 'sprint' ? 'Sprint' : 'Estimate',
        );
      if (names.has(field.name.toLowerCase()))
        return mapping('field', field.name, 'match', field.name);
      const kind = fieldKindOf(field);
      return kind
        ? mapping(
            'field',
            field.name,
            'create',
            field.name,
            `A ${kind} field, created when an issue uses it`,
          )
        : mapping(
            'field',
            field.name,
            'report',
            null,
            'Work has no field of this kind; values are reported',
          );
    });
}

/**
 * What a run would do with the picked projects: each project created or matched by key, the
 * issue types and statuses its issues use mapped, and the custom fields matched, created or
 * reported. Nothing is written.
 */
export async function planJira(
  sql: SqlClient,
  connection: ImportConnection,
  containers: readonly ImportContainerRef[],
  ctx: ImportPlanContext,
): Promise<ImportPlan> {
  const client = jiraClientFor(connection, ctx);
  try {
    const picked = containers.filter((container) => container.key);
    const details = await inBatches(picked.slice(0, PLAN_DETAIL_LIMIT), 4, async (ref) => ({
      project: await client.project(ref.key!),
      statuses: await client.statuses(ref.key!),
    }));
    const fields = await client.fields();
    const mapped = await ctx.mappings.getMany(
      'project',
      picked.map((project) => project.id),
    );
    const types = await workTypes(sql, null);
    const statuses = await workStatuses(sql, null);
    const mappings: ImportMapping[] = [];
    const seenTypes = new Map<string, JiraIssueType>();
    const seenStatuses = new Map<string, JiraStatus>();
    for (const { project, statuses: byType } of details) {
      const key = projectKeyFrom(project.key);
      const [existing] = await sql<{ id: string }[]>`select id from projects where key = ${key}`;
      const note = key === project.key ? null : `The key becomes ${key}`;
      if (mapped.has(project.id))
        mappings.push(mapping('project', project.key, 'match', key, 'Imported before; updated'));
      else if (existing)
        mappings.push(
          mapping('project', project.key, 'match', key, 'A project with this key exists'),
        );
      else mappings.push(mapping('project', project.key, 'create', key, note));
      for (const type of project.issueTypes ?? []) seenTypes.set(type.name.toLowerCase(), type);
      for (const group of byType) {
        for (const status of group.statuses) seenStatuses.set(status.name.toLowerCase(), status);
      }
    }
    for (const type of seenTypes.values()) {
      const match = matchIssueType(type, types);
      mappings.push(
        mapping(
          'issue_type',
          type.name,
          'match',
          match?.row.name ?? null,
          match && !match.byName ? 'Matched by level' : null,
        ),
      );
    }
    const statusNames = new Set(statuses.map((status) => status.name.toLowerCase()));
    for (const status of seenStatuses.values()) {
      mappings.push(
        statusNames.has(status.name.toLowerCase())
          ? mapping('status', status.name, 'match', status.name)
          : mapping(
              'status',
              status.name,
              'create',
              status.name,
              "Added to the project's workflow",
            ),
      );
    }
    mappings.push(...planFields(fields, await workFields(sql, null)));
    return {
      containers: containers.map((container) => container.id),
      counts: {
        projects: picked.length,
        issues: picked.reduce((sum, ref) => sum + (ref.count ?? 0), 0),
      },
      mappings,
    };
  } catch (error) {
    return explainJiraError(error);
  }
}
