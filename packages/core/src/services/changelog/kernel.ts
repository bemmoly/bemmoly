import type { Changelog } from '../../contracts/changelog.ts';
import { loadChangelogFolder } from './discover.ts';

/** packages/core/changelog: the kernel's own changesets, a sibling of src/. */
export const KERNEL_CHANGELOG_FOLDER = new URL('../../../changelog/', import.meta.url);

export function loadKernelChangelog(): Promise<Changelog> {
  return loadChangelogFolder(KERNEL_CHANGELOG_FOLDER);
}
