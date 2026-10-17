import type {
  ImportConnection,
  ImportContainerRef,
  ImportPerson,
  ImportSourceContext,
} from '@bemmoly/core';
import { explainJiraError, jiraClientFor } from './connection.ts';
import { inBatches } from './discover.ts';
import { personId } from './issue-rows.ts';

/**
 * Projects whose people are listed for the plan; on a larger choice the rest are matched by
 * email as the run meets them, the same way.
 */
export const PEOPLE_PROJECT_LIMIT = 50;

/**
 * Everyone who can be assigned issues in the chosen projects, as the run will name them
 * (account id on Cloud, key on Data Center), with their email when Jira shows it.
 */
export async function peopleOfJira(
  connection: ImportConnection,
  containers: readonly ImportContainerRef[],
  ctx: ImportSourceContext,
): Promise<ImportPerson[]> {
  const client = jiraClientFor(connection, ctx);
  try {
    const keyed = containers.filter((container) => container.key).slice(0, PEOPLE_PROJECT_LIMIT);
    const lists = await inBatches(keyed, 4, (container) => client.assignable(container.key!));
    const people = new Map<string, ImportPerson>();
    for (const user of lists.flat()) {
      const sourceId = personId(user);
      if (!sourceId || people.has(sourceId)) continue;
      people.set(sourceId, {
        sourceId,
        email: user.emailAddress ?? null,
        name: user.displayName ?? user.name ?? sourceId,
      });
    }
    return [...people.values()];
  } catch (error) {
    return explainJiraError(error);
  }
}
