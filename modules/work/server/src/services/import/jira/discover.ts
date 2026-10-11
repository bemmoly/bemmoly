import type { ImportConnection, ImportSourceContext } from '@bemmoly/core';
import type { ImportDiscovery } from '@bemmoly/shared';
import { explainJiraError, jiraClientFor, parseJiraConnection } from './connection.ts';

/** Projects whose issues are counted one by one at connect time; the rest show no count. */
const COUNTED_PROJECTS = 200;
const COUNT_CONCURRENCY = 6;

export const projectJql = (key: string) =>
  `project = "${key.replace(/"/g, '\\"')}" order by created asc`;

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

/** Tests the token and lists the projects, each with its issue count. */
export async function discoverJira(
  connection: ImportConnection,
  ctx: ImportSourceContext,
): Promise<ImportDiscovery> {
  const parsed = parseJiraConnection(connection);
  const client = jiraClientFor(connection, ctx);
  try {
    await client.myself();
    const projects = await client.projects();
    const counted = projects.slice(0, COUNTED_PROJECTS);
    const counts = await inBatches(counted, COUNT_CONCURRENCY, (project) =>
      client.countIssues(projectJql(project.key)),
    );
    const warnings: string[] = [];
    if (projects.length > COUNTED_PROJECTS) {
      warnings.push(`Issues were counted for the first ${COUNTED_PROJECTS} projects only.`);
    }
    if (!projects.length) warnings.push('The token can see no projects.');
    return {
      site: new URL(parsed.baseUrl).host,
      containers: projects.map((project, index) => ({
        id: project.id,
        key: project.key,
        name: project.name,
        kind: 'project',
        count: counts[index] ?? null,
      })),
      counts: {
        projects: projects.length,
        issues: counts.reduce((sum, count) => sum + count, 0),
      },
      warnings,
    };
  } catch (error) {
    return explainJiraError(error);
  }
}
