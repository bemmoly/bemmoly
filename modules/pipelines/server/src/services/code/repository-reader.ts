/*
 * Reading repositories, as a port: discovery lists the ones the hosts let Pipelines read,
 * then walks each one's tree and reads a few files. The code host wiring supplies a reader
 * over the host's API; tests read fixture folders on disk.
 */

export interface RepositoryTree {
  /** The commit the tree was read at. */
  commitSha: string;
  /** Every file path in the repository, relative to its root, with "/" separators. */
  paths: readonly string[];
  /** A file's text, or null when it is missing, binary or too large to matter. */
  read(path: string): Promise<string | null>;
}

/** A repository a connected host lets Pipelines read. */
export interface VisibleRepository {
  fullName: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'other';
  /** null when the host was not asked; the repository's row keeps what it knows. */
  defaultBranch: string | null;
  url: string | null;
}

export interface RepositoryReader {
  /** The tree at the default branch's head; null when the host cannot read it. */
  tree(repository: string, ref: string): Promise<RepositoryTree | null>;
  /** Every repository the hosts let Pipelines read; null when no host is connected. */
  visible(): Promise<VisibleRepository[] | null>;
}

export const noRepositoryReader: RepositoryReader = {
  tree: async () => null,
  visible: async () => null,
};
