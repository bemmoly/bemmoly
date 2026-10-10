import { diffBlocks } from './blocks.ts';
import type { BlockDiff, DiffStats, DocDiff, DiffNode } from './types.ts';

export { changedBlock, diffBlocks } from './blocks.ts';
export { canonical, similarity, textOf } from './canonical.ts';
export { diffInline, inlineChanged } from './inline.ts';
export * from './types.ts';

/** Counts what a reader sees at the top: blocks inserted, deleted, changed in place and moved. */
function statsOf(blocks: readonly BlockDiff[]): DiffStats {
  const stats: DiffStats = { inserted: 0, deleted: 0, changed: 0, moved: 0 };
  for (const block of blocks) {
    if (block.op === 'insert') stats.inserted += 1;
    else if (block.op === 'delete') stats.deleted += 1;
    else if (block.op === 'change') stats.changed += 1;
    else if (block.op === 'move') stats.moved += 1;
  }
  return stats;
}

/**
 * The structural diff between two ProseMirror documents (snapshots of one
 * page at two revisions). A missing document reads as an empty one, so the
 * first revision compares as all inserted.
 */
export function diffDocs(
  before: DiffNode | null | undefined,
  after: DiffNode | null | undefined,
): DocDiff {
  const blocks = diffBlocks(before?.content ?? [], after?.content ?? []);
  return { blocks, stats: statsOf(blocks) };
}
