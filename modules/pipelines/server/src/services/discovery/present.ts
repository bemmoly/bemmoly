import type { SqlExecutor } from '@bemmoly/core';
import type {
  DiscoveryProposal,
  DiscoverySignal,
  ProposalsPage,
} from '../../../../shared/catalog-writes.ts';
import { REPOSITORY_FILE_PATH } from '../../../../shared/repository-yaml.ts';
import type { Runtime } from '../../../../shared/common.ts';
import type { ProposalRow } from '../../models/catalog-writes.ts';
import { iso } from '../../utils/time.ts';
import { ownerRefOf } from '../catalog-writes/owners.ts';
import { writeRepositoryProposal } from './repository-proposal.ts';

export const PROPOSAL_SELECT = `
  p.id, p.repository_id, r.full_name as repository_full_name, r.url as repository_url,
  r.provider as repository_provider, r.default_branch as repository_default_branch,
  p.path, p.key, p.name, p.description, p.signals, p.runtime, p.owner_raw, p.owner_source,
  p.owner_team_id, t.name as owner_team_name, p.group_path, p.state, p.shared_build,
  a.key as application_key, p.created_at`;

export const PROPOSAL_FROM = `
  pipeline_discovery_proposals p
  join pipeline_repositories r on r.id = p.repository_id
  left join teams t on t.id = p.owner_team_id
  left join pipeline_applications a on a.id = p.application_id`;

export function toProposal(row: ProposalRow): DiscoveryProposal {
  return {
    id: row.id,
    repository: {
      id: row.repository_id,
      fullName: row.repository_full_name,
      url: row.repository_url,
    },
    path: row.path,
    key: row.key,
    name: row.name,
    description: row.description,
    signals: row.signals as DiscoverySignal[],
    runtime: row.runtime as Runtime,
    owner:
      row.owner_raw && row.owner_source
        ? {
            team:
              row.owner_team_id && row.owner_team_name
                ? { id: row.owner_team_id, name: row.owner_team_name }
                : null,
            raw: row.owner_raw,
            source: row.owner_source,
          }
        : null,
    group: row.group_path,
    sharedBuild: row.shared_build,
    state: row.state,
    applicationKey: row.application_key,
    createdAt: iso(row.created_at),
  };
}

/** The repository file accepting would open, for each repository whose proposals share a build. */
export async function proposedRepositoryFiles(
  sql: SqlExecutor,
  repositoryIds: readonly string[],
): Promise<ProposalsPage['repositoryFiles']> {
  if (repositoryIds.length === 0) return [];
  const rows = await sql<ProposalRow[]>`
    select ${sql.unsafe(PROPOSAL_SELECT)} from ${sql.unsafe(PROPOSAL_FROM)}
    where p.repository_id = any(${[...new Set(repositoryIds)]}::uuid[])
      and p.state = 'proposed' and p.shared_build is not null
    order by lower(r.full_name), p.path`;
  const byRepository = new Map<string, ProposalRow[]>();
  for (const row of rows) {
    byRepository.set(row.repository_full_name, [
      ...(byRepository.get(row.repository_full_name) ?? []),
      row,
    ]);
  }
  return [...byRepository].map(([repository, proposals]) => ({
    repository,
    path: REPOSITORY_FILE_PATH,
    content: writeRepositoryProposal(
      proposals.flatMap((row) =>
        row.shared_build
          ? [
              {
                key: row.key,
                path: row.path,
                group: row.group_path,
                owner: row.owner_team_name ? ownerRefOf({ name: row.owner_team_name }) : null,
                runtime: row.runtime,
                description: row.description,
                build: row.shared_build,
              },
            ]
          : [],
      ),
    ),
  }));
}
