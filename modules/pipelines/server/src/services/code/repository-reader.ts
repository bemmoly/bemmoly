/*
 * Reading a repository at one commit, as a port: discovery walks its tree and reads a few
 * files. The code host wiring supplies a reader over the host's API; tests read fixture
 * folders on disk.
 */

export interface RepositoryTree {
  /** The commit the tree was read at. */
  commitSha: string;
  /** Every file path in the repository, relative to its root, with "/" separators. */
  paths: readonly string[];
  /** A file's text, or null when it is missing, binary or too large to matter. */
  read(path: string): Promise<string | null>;
}

export interface RepositoryReader {
  /** The tree at the default branch's head; null when the host cannot read it. */
  tree(repository: string, ref: string): Promise<RepositoryTree | null>;
}

export const noRepositoryReader: RepositoryReader = { tree: async () => null };
