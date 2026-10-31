import { matchesFilters } from '../../utils/glob.ts';

/*
 * Which applications of a repository a change touches (monorepos, architecture §7). An
 * application is touched when a file under its folder changed, or one its `paths:` filters
 * match (the repository file's default paths are already in them); its folder is always one
 * of its filters, so shared paths only ever add to it, and a `!` filter can still leave files
 * out. An application at the repository root with no filters is touched by any change. When
 * the code host did not say which files changed, every application is: building too much is
 * safe, missing one is not.
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
      const folder = candidate.path.replace(/^\.?\/?/, '').replace(/\/$/, '');
      if (candidate.paths.length > 0) {
        const filters = folder ? [`${folder}/**`, ...candidate.paths] : candidate.paths;
        return changedPaths.some((path) => matchesFilters(path, filters));
      }
      if (!folder) return changedPaths.length > 0;
      return changedPaths.some((path) => path === folder || path.startsWith(`${folder}/`));
    })
    .map((candidate) => candidate.key);
}
