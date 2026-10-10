import type { SqlExecutor } from '@bemmoly/core';
import { applyUpdate, Doc } from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import { snapshotToUpdate } from './convert.ts';
import { mergeLog, readLog } from './log.ts';

/**
 * A read-only copy of a page's Yjs document as stored: page_state and every update after it,
 * which is what open editors converged on. A page never opened has no log; its snapshot is
 * converted instead. The caller destroys the copy.
 */
export async function readPageDoc(sql: SqlExecutor, pageId: string): Promise<Doc> {
  const doc = new Doc();
  const stored = mergeLog(await readLog(sql, pageId));
  if (stored) {
    applyUpdate(doc, stored);
    return doc;
  }
  const [page] = await sql<{ snapshot: RichText | null }[]>`
    select snapshot from pages where id = ${pageId}`;
  if (page?.snapshot) applyUpdate(doc, snapshotToUpdate(page.snapshot));
  return doc;
}
