import type { JobDefinition } from '@bemmoly/core';
import { z } from 'zod';
import { DOCS_COMPACT_JOB, type PageCollab } from '../services/collab/index.ts';

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
