import { ProviderError } from '@bemmoly/shared';
import type { PipelinesCodeHosts } from './hosts.ts';
import type { PullRequestOpener } from './pull-requests.ts';
import type { RepositoryReader } from './repository-reader.ts';

/*
 * The catalog's ports over the connected code hosts: pull requests for application.yaml
 * changes and discovery, and repository trees for discovery. Both are bulk work.
 */

export function codeHostPullRequests(hosts: PipelinesCodeHosts): PullRequestOpener {
  return {
    async openPullRequest(input) {
      const client = await hosts.client(input.repository, 'bulk');
      if (!client) return null;
      const pull = await client.openPullRequest(input);
      return { url: pull.url };
    },
  };
}

/** Files larger than this are not read for discovery; manifests are small. */
const MAX_FILES = 20_000;

export function codeHostRepositories(hosts: PipelinesCodeHosts): RepositoryReader {
  return {
    async tree(repository, ref) {
      const client = await hosts.client(repository, 'bulk');
      if (!client) return null;
      const listing = await client.listFiles(repository, ref);
      if (listing.paths.length > MAX_FILES) {
        throw new ProviderError(`${repository} has more files than discovery reads at once`);
      }
      return {
        commitSha: ref,
        paths: listing.paths,
        read: (path) => client.readFile(repository, path, ref),
      };
    },
  };
}
