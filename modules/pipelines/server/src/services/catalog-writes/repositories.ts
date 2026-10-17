import type { SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { RepositoryInput } from '../../../../shared/catalog-writes.ts';

export interface RepositoryRecord {
  id: string;
  full_name: string;
  default_branch: string;
  url: string | null;
}

/** The catalog's row for a repository, created on first sight and kept current after. */
export async function upsertRepository(
  sql: SqlExecutor,
  input: Pick<RepositoryInput, 'fullName'> & Partial<RepositoryInput>,
): Promise<RepositoryRecord> {
  const provider = input.provider ?? 'github';
  const [row] = await sql<RepositoryRecord[]>`
    insert into pipeline_repositories (provider, full_name, default_branch, url)
    values (${provider}, ${input.fullName}, ${input.defaultBranch ?? 'main'}, ${input.url ?? null})
    on conflict (provider, lower(full_name)) do update set
      default_branch = coalesce(${input.defaultBranch ?? null}, pipeline_repositories.default_branch),
      url = coalesce(${input.url ?? null}, pipeline_repositories.url),
      archived_at = null, updated_at = now()
    returning id, full_name, default_branch, url`;
  if (!row) throw new ProviderError('The repository could not be saved');
  return row;
}
