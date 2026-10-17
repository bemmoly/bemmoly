import type {
  ImportConnection,
  ImportContainerRef,
  ImportPerson,
  ImportSourceContext,
} from '@bemmoly/core';
import { confluenceClientFor, explainConfluenceError } from './connection.ts';

/** People listed for the plan; on a bigger site the rest are matched as the run meets them. */
export const PEOPLE_LIMIT = 1000;

/**
 * The site's people, as the run will name them (account id on Cloud, user key on Data
 * Center), with their email when Confluence shows it. Confluence has no cheap per-space list,
 * so the plan takes the site's users; the run matches whoever it meets the same way.
 */
export async function peopleOfConfluence(
  connection: ImportConnection,
  _containers: readonly ImportContainerRef[],
  ctx: ImportSourceContext,
): Promise<ImportPerson[]> {
  const client = confluenceClientFor(connection, ctx);
  try {
    const users = await client.people(PEOPLE_LIMIT);
    const people = new Map<string, ImportPerson>();
    for (const user of users) {
      const sourceId = user.accountId ?? user.userKey ?? user.username;
      if (!sourceId || people.has(sourceId)) continue;
      people.set(sourceId, {
        sourceId,
        email: user.email ?? null,
        name: user.displayName ?? user.publicName ?? user.username ?? sourceId,
      });
    }
    return [...people.values()];
  } catch (error) {
    return explainConfluenceError(error);
  }
}
