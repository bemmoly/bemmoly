import type { SqlExecutor } from '@bemmoly/core';
import { z } from 'zod';
import { importedPageSchema, type ImportedPage } from '../../../../shared/transfer.ts';
import type { RichText } from '../../../../shared/common.ts';
import { bodyReferences, type BodyReferences } from '../links/rewrite.ts';

/*
 * The record of imports already written, keyed per space by the import's idempotency key.
 * The row is written in the transaction that creates the pages, so it exists exactly when
 * they do: a retry that finds it returns those pages instead of importing them again.
 */

const storedPagesSchema = z.array(importedPageSchema);

/** The pages an earlier run of this import wrote, or null when none has committed. */
export async function importedEarlier(
  tx: SqlExecutor,
  spaceId: string,
  key: string,
): Promise<ImportedPage[] | null> {
  const [row] = await tx<{ pages: unknown }[]>`
    select pages from page_imports where space_id = ${spaceId} and idempotency_key = ${key}`;
  return row ? storedPagesSchema.parse(row.pages) : null;
}

export async function recordImport(
  tx: SqlExecutor,
  spaceId: string,
  key: string,
  pages: readonly ImportedPage[],
): Promise<void> {
  await tx`
    insert into page_imports (space_id, idempotency_key, pages)
    values (${spaceId}, ${key}, ${JSON.stringify(pages)}::jsonb)`;
}

/** The link references of pages already imported, read back from their stored bodies. */
export async function storedReferences(
  tx: SqlExecutor,
  pages: readonly ImportedPage[],
): Promise<{ id: string; references: BodyReferences }[]> {
  const ids = pages.map((page) => page.id);
  const rows = await tx<{ id: string; snapshot: RichText | null }[]>`
    select id, snapshot from pages where id = any(${ids}::uuid[]) and deleted_at is null`;
  return rows
    .filter((row) => row.snapshot !== null)
    .map((row) => ({ id: row.id, references: bodyReferences(row.snapshot!, row.id) }));
}
