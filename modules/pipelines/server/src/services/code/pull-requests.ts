/*
 * Opening a pull request on the code host, as a port: the catalog writes application.yaml
 * changes and discovery's new files through it, and the code host wiring supplies the real
 * one. Vendor shapes stay behind it.
 */

export interface PullRequestInput {
  /** owner/repository. */
  repository: string;
  baseBranch: string;
  /** The branch to create with the change: "bemmoly/catalog/checkout-api-1a2b". */
  branch: string;
  title: string;
  body: string;
  files: Array<{ path: string; content: string }>;
}

export interface PullRequestOpener {
  /**
   * Opens the pull request and answers its URL, or null when this host cannot open one
   * (not connected, no write permission); a ProviderError means it tried and failed. Either
   * way the change waits as pending, so nothing a person asked for is lost.
   */
  openPullRequest(input: PullRequestInput): Promise<{ url: string } | null>;
}

/** Until a code host is wired, every change waits as pending. */
export const noPullRequests: PullRequestOpener = {
  openPullRequest: async () => null,
};
