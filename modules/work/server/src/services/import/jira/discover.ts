import type {
  ImportConnection,
  ImportContainerRef,
  ImportPlanContext,
  ImportSourceContext,
  SqlClient,
} from '@bemmoly/core';
import type { ImportContainer, ImportDiscovery } from '@bemmoly/shared';
import type { JiraProject } from '../../../clients/jira.ts';
import { explainJiraError, jiraClientFor, parseJiraConnection } from './connection.ts';
import { projectKeyFrom } from './schema.ts';

const COUNT_CONCURRENCY = 6;
/** project/search takes at most 50 keys per call. */
const INSIGHT_BATCH = 50;

export const projectJql = (key: string) =>
  `project = "${key.replace(/[\\"]/g, '\\$&')}" order by created asc`;

/** Runs `work` over items, a few at a time, keeping order. */
export async function inBatches<T, R>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    out.push(...(await Promise.all(items.slice(start, start + size).map(work))));
  }
  return out;
}

const TYPES: Record<string, string> = {
  software: 'Software',
  business: 'Business',
  service_desk: 'Service',
  product_discovery: 'Discovery',
};

/** What an earlier import of this site made, and which Work keys are taken already. */
async function hereAlready(
  sql: SqlClient,
  projects: readonly JiraProject[],
  ctx: ImportPlanContext,
) {
  const mapped = await ctx.mappings.getMany(
    'project',
    projects.map((project) => project.id),
  );
  const targets = await sql<{ id: string; key: string; name: string }[]>`
    select id, key, name from projects
    where id = any(${[...mapped.values()].map((row) => row.targetId)}::uuid[])`;
  const byId = new Map(targets.map((row) => [row.id, row]));
  const keys = projects.map((project) => projectKeyFrom(project.key));
  const taken = await sql<{ id: string; key: string }[]>`
    select id, key from projects where key = any(${keys}::text[])`;
  return { mapped, byId, taken: new Map(taken.map((row) => [row.key, row.id])) };
}

/**
 * Tests the token and lists the projects, quickly: no issue counts (count() fills them in on
 * demand), each project's type and lead, whether the token can read its issues (Cloud lists
 * what it can browse apart from what it can only see), what an earlier import made of it, and
 * whether its key is taken here by something else.
 */
export async function discoverJira(
  sql: SqlClient,
  connection: ImportConnection,
  ctx: ImportPlanContext,
): Promise<ImportDiscovery> {
  const parsed = parseJiraConnection(connection);
  const client = jiraClientFor(connection, ctx);
  try {
    await client.myself();
    const projects = await client.projects();
    const browsable =
      parsed.deployment === 'cloud'
        ? new Set((await client.projects('browse')).map((project) => project.id))
        : null;
    const { mapped, byId, taken } = await hereAlready(sql, projects, ctx);
    const containers = projects.map((project): ImportContainer => {
      const mapping = mapped.get(project.id);
      const target = mapping ? byId.get(mapping.targetId) : undefined;
      const holder = taken.get(projectKeyFrom(project.key));
      return {
        id: project.id,
        key: project.key,
        name: project.name,
        kind: 'project',
        count: null,
        type: TYPES[project.projectTypeKey ?? ''] ?? null,
        lead: project.lead?.displayName ?? null,
        access: browsable && !browsable.has(project.id) ? 'none' : 'ok',
        imported: target
          ? { ...target, at: mapping?.updatedAt ?? new Date(0).toISOString() }
          : null,
        keyInUse: holder !== undefined && holder !== target?.id,
      };
    });
    const unreadable = containers.filter((container) => container.access === 'none').length;
    return {
      site: new URL(parsed.baseUrl).host,
      containers,
      counts: { projects: projects.length },
      warnings: [
        ...(projects.length ? [] : ['The token can see no projects.']),
        ...(unreadable
          ? [
              `${unreadable} of the projects are listed but their issues are hidden from this token.`,
            ]
          : []),
      ],
    };
  } catch (error) {
    return explainJiraError(error);
  }
}

/**
 * Issues per project. Cloud asks project/search with expand=insight for up to 50 at once;
 * whatever that leaves out (Data Center, or insight missing) is counted one by one.
 */
export async function countJira(
  connection: ImportConnection,
  containers: readonly ImportContainerRef[],
  ctx: ImportSourceContext,
): Promise<Record<string, number>> {
  const client = jiraClientFor(connection, ctx);
  const counts: Record<string, number> = {};
  try {
    const keyed = containers.filter((container) => container.key);
    for (let start = 0; start < keyed.length; start += INSIGHT_BATCH) {
      const batch = keyed.slice(start, start + INSIGHT_BATCH);
      const found = await client.insightCounts(batch.map((container) => container.key!));
      for (const container of batch) {
        const total = found.get(container.key!);
        if (total !== undefined) counts[container.id] = total;
      }
    }
    const rest = keyed.filter((container) => counts[container.id] === undefined);
    const totals = await inBatches(rest, COUNT_CONCURRENCY, (container) =>
      client.countIssues(projectJql(container.key!)),
    );
    rest.forEach((container, index) => (counts[container.id] = totals[index] ?? 0));
    return counts;
  } catch (error) {
    return explainJiraError(error);
  }
}
