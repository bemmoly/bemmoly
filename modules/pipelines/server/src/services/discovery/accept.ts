import type { RequestContext, SqlClient } from '@bemmoly/core';
import { isBemmolyError, ProviderError } from '@bemmoly/shared';
import type {
  AcceptProposalsBody,
  AcceptProposalsResult,
  CreateApplicationBody,
} from '../../../../shared/catalog-writes.ts';
import type { ProposalRow } from '../../models/catalog-writes.ts';
import type { ApplicationWrites } from '../catalog-writes/applications.ts';
import { applicationFilePath, writeApplicationFile } from '../catalog-writes/file.ts';
import { ownerRefOf } from '../catalog-writes/owners.ts';
import type { PullRequestOpener } from '../code/pull-requests.ts';
import { personOf } from '../deps.ts';
import { PROPOSAL_FROM, PROPOSAL_SELECT } from './present.ts';

/*
 * Bulk accept (product design: "a platform engineer accepts them in bulk"). Each proposal
 * becomes an application through the catalog's own writes, so the same checks apply; one
 * that fails says why and the rest go on. Then one pull request per repository adds the
 * application.yaml files, so the repository becomes the source of truth once it merges.
 */

interface Created {
  proposal: ProposalRow;
  applicationId: string;
  key: string;
  file: { path: string; content: string };
}

async function openPerRepository(
  sql: SqlClient,
  opener: PullRequestOpener,
  created: readonly Created[],
  createdBy: string | null,
): Promise<AcceptProposalsResult['pullRequests']> {
  const byRepository = new Map<string, Created[]>();
  for (const item of created) {
    const list = byRepository.get(item.proposal.repository_id) ?? [];
    list.push(item);
    byRepository.set(item.proposal.repository_id, list);
  }
  const results: AcceptProposalsResult['pullRequests'] = [];
  for (const [repositoryId, items] of byRepository) {
    const [repo] = await sql<{ full_name: string; default_branch: string }[]>`
      select full_name, default_branch from pipeline_repositories where id = ${repositoryId}::uuid`;
    if (!repo) continue;
    let url: string | null = null;
    let reason = 'The code host is not connected for pull requests yet';
    try {
      const opened = await opener.openPullRequest({
        repository: repo.full_name,
        baseBranch: repo.default_branch,
        branch: `bemmoly/catalog/discovery-${Date.now().toString(36)}`,
        title: `Add ${items.length} ${items.length === 1 ? 'application' : 'applications'} to the Pipelines catalog`,
        body: `Adds .bemmoly/application.yaml for ${items.map((item) => item.key).join(', ')}.\n\nProposed by Bemmoly Pipelines discovery. Review owners and tiers like code; the catalog follows these files once this merges.`,
        files: items.map((item) => item.file),
      });
      url = opened?.url ?? null;
    } catch (error) {
      if (!(error instanceof ProviderError) && !isBemmolyError(error)) throw error;
      reason = `The code host could not open a pull request: ${error.message}`;
    }
    for (const item of items) {
      await sql`
        insert into pipeline_catalog_changes
          (application_id, repository_id, kind, state, summary, file_path, file_content,
           pull_request_url, reason, created_by)
        values (${item.applicationId}::uuid, ${repositoryId}::uuid, 'create',
          ${url ? 'pull_request' : 'pending'}, ${`Adds ${item.key} to the catalog`},
          ${item.file.path}, ${item.file.content}, ${url}, ${url ? null : reason},
          ${createdBy}::uuid)`;
    }
    results.push({ repository: repo.full_name, url, pending: url === null });
  }
  return results;
}

export async function acceptProposals(
  ctx: RequestContext,
  sql: SqlClient,
  applications: ApplicationWrites,
  opener: PullRequestOpener,
  body: AcceptProposalsBody,
): Promise<AcceptProposalsResult> {
  const ids = body.items.map((item) => item.id);
  const rows = await sql<ProposalRow[]>`
    select ${sql.unsafe(PROPOSAL_SELECT)} from ${sql.unsafe(PROPOSAL_FROM)}
    where p.id = any(${ids}::uuid[]) and p.state = 'proposed'`;
  const created: Created[] = [];
  const failed: AcceptProposalsResult['failed'] = [];
  for (const item of body.items) {
    const proposal = rows.find((row) => row.id === item.id);
    if (!proposal) {
      failed.push({
        proposal: item.id,
        message: 'This proposal was already accepted or dismissed',
      });
      continue;
    }
    const group = item.group ?? proposal.group_path ?? body.group;
    if (!group) {
      failed.push({ proposal: item.id, message: 'Choose a group for it' });
      continue;
    }
    const input: CreateApplicationBody = {
      key: item.key ?? proposal.key,
      name: proposal.name,
      description: proposal.description,
      group,
      owner: item.owner !== undefined ? item.owner : proposal.owner_team_id,
      tier: item.tier ?? 2,
      labels: [],
      lifecycle: 'production',
      runtime: proposal.runtime as CreateApplicationBody['runtime'],
      ciMode: 'runners',
      promotionMode: 'approval',
      dependsOn: [],
      paths: [],
      repository: {
        fullName: proposal.repository_full_name,
        provider: proposal.repository_provider,
        defaultBranch: proposal.repository_default_branch,
      },
      path: proposal.path,
    };
    try {
      const result = await applications.create(ctx, input, { pullRequest: false });
      await sql`update pipeline_discovery_proposals set state = 'accepted',
          application_id = ${result.application.id}::uuid, updated_at = now()
        where id = ${proposal.id}::uuid`;
      const [domain, groupKey] = group.split('/');
      created.push({
        proposal,
        applicationId: result.application.id,
        key: input.key,
        file: {
          path: applicationFilePath(proposal.path),
          content: writeApplicationFile({
            name: input.key,
            group: groupKey ?? '',
            domain,
            ...(result.application.ownerTeam
              ? { owner: ownerRefOf(result.application.ownerTeam) }
              : {}),
            tier: input.tier,
            runtime: input.runtime,
            ...(input.description ? { description: input.description } : {}),
          }),
        },
      });
    } catch (error) {
      if (!isBemmolyError(error)) throw error;
      failed.push({ proposal: item.id, message: error.message });
    }
  }
  const pullRequests = body.openPullRequests
    ? await openPerRepository(sql, opener, created, personOf(ctx.actor))
    : [];
  return {
    created: created.map((item) => ({ proposal: item.proposal.id, application: item.key })),
    failed,
    pullRequests,
  };
}
