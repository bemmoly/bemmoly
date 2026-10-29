import type { ConnectionAccounts } from '../../../hooks/use-clouds.ts';
import type { PoolDraft } from './pool-draft.ts';

/*
 * The projects a pool whose machines Pipelines starts may run in, and the defaults a draft
 * takes from the one it names.
 */

export interface BuildProject {
  id: string;
  externalId: string;
  name: string;
  connection: string;
  region: string;
  /** The service account a CI project Pipelines made builds as; null for attached ones. */
  builder: string | null;
  /** Pipelines made the project, so it may create a cluster there too. */
  created: boolean;
}

/** Projects builds may run in: the CI projects Pipelines made, and any attached one, ready. */
export function buildProjects(items: readonly ConnectionAccounts[]): BuildProject[] {
  return items.flatMap(({ connection, accounts }) =>
    connection.provider !== 'gcp'
      ? []
      : accounts
          .filter(
            (account) =>
              account.status === 'ready' &&
              (account.purpose === 'ci' || account.origin === 'attached'),
          )
          .map((account) => ({
            id: account.id,
            externalId: account.externalId,
            name: account.name,
            connection: connection.name,
            region: connection.region ?? '',
            builder:
              account.origin === 'created'
                ? `builder@${account.externalId}.iam.gserviceaccount.com`
                : null,
            created: account.origin === 'created',
          })),
  );
}

export const projectOf = (projects: readonly BuildProject[], id: string | null) =>
  projects.find((project) => project.id === id) ?? null;

export const regionOfDraft = (draft: PoolDraft, projects: readonly BuildProject[]) =>
  draft.region ?? projectOf(projects, draft.accountId)?.region ?? '';

export const serviceAccountOfDraft = (draft: PoolDraft, projects: readonly BuildProject[]) =>
  draft.serviceAccount ?? projectOf(projects, draft.accountId)?.builder ?? '';
