import type { JobDefinition } from '@bemmoly/core';
import { z } from 'zod';
import { IMPORT_FORMATS, importFileSchema } from '../../../shared/transfer.ts';
import { DOCS_COMPACT_JOB, type PageCollab } from '../services/collab/index.ts';
import { DOCS_PURGE_JOB } from '../services/pages/purge.ts';
import type { PagesService } from '../services/pages/index.ts';
import { DOCS_IMPORT_JOB, type TransferService } from '../services/transfer/index.ts';

const compactPayloadSchema = z.object({ pageId: z.uuid() });

/**
 * docs.compact: folds a page's Yjs update log into page_state. Enqueued by the collab hook
 * with an idempotency key per threshold's worth of updates; running it twice folds nothing
 * the second time.
 */
export function compactJob(collab: Pick<PageCollab, 'compact'>): JobDefinition {
  return {
    name: DOCS_COMPACT_JOB,
    retryLimit: 3,
    handle: async (payload) => {
      const { pageId } = compactPayloadSchema.parse(payload);
      await collab.compact(pageId);
    },
  };
}

const importPayloadSchema = z.object({
  spaceId: z.uuid(),
  parentId: z.uuid().nullable(),
  userId: z.uuid().nullable(),
  format: z.enum(IMPORT_FORMATS),
  files: z.array(importFileSchema).min(1),
});

/**
 * docs.import: writes a large import queued by POST /spaces/:spaceKey/imports. Enqueued with an
 * idempotency key per upload, so a retried request imports once; the import is one
 * transaction, so a failed run leaves nothing to clean up before its retry.
 */
export function importJob(transfer: Pick<TransferService, 'runQueuedImport'>): JobDefinition {
  return {
    name: DOCS_IMPORT_JOB,
    retryLimit: 2,
    handle: async (payload) => {
      await transfer.runQueuedImport(importPayloadSchema.parse(payload));
    },
  };
}

/**
 * docs.purge-trash: deletes pages trashed more than the retention ago, nightly. Scheduled, so
 * pg-boss sends one run per cron tick (the tick is its idempotency key) and the singleton
 * policy keeps two workers from overlapping; a repeat run finds nothing left to delete.
 */
export function purgeTrashJob(pages: Pick<PagesService, 'purgeExpiredTrash'>): JobDefinition {
  return {
    name: DOCS_PURGE_JOB,
    schedule: '17 3 * * *',
    singleton: true,
    retryLimit: 2,
    handle: async () => {
      await pages.purgeExpiredTrash();
    },
  };
}
