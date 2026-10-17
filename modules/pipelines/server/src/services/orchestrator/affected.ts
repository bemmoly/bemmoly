import { matchesFilters } from '../../utils/glob.ts';

/*
 * Which applications of a repository a change touches (monorepos, architecture §7). An
 * application with `paths:` filters is touched when a changed file matches them; without
 * filters, when a file under its folder changed; an application at the repository root is
 * touched by any change. When the code host did not say which files changed, every
 * application is: building too much is safe, missing one is not.
 */

export interface AffectedCandidate {
  key: string;
  /** Its folder in the repository, "" for the root. */
  path: string;
  paths: readonly string[];
}

export function affectedApplications(
  candidates: readonly AffectedCandidate[],
  changedPaths: readonly string[] | null,
): string[] {
  if (changedPaths === null) return candidates.map((candidate) => candidate.key);
  return candidates
    .filter((candidate) => {
      if (candidate.paths.length > 0) {
        return changedPaths.some((path) => matchesFilters(path, candidate.paths));
      }
      const folder = candidate.path.replace(/^\.?\/?/, '').replace(/\/$/, '');
      if (!folder) return changedPaths.length > 0;
      return changedPaths.some((path) => path === folder || path.startsWith(`${folder}/`));
    })
    .map((candidate) => candidate.key);
}
