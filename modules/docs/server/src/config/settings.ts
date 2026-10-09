import type { SettingsRegistry } from '@bemmoly/core';
import { z } from 'zod';

declare module '@bemmoly/core' {
  interface SettingsKeys {
    'docs.staleAfterDays': number;
    'docs.compactThreshold': number;
  }
}

/**
 * Docs defaults: when a published page counts as stale on the Docs home's
 * "needs attention", and how many Yjs updates a page collects before the
 * docs.compact job folds them into page_state.
 */
export function defineDocsSettings(settings: SettingsRegistry): void {
  settings.define({
    key: 'docs.staleAfterDays',
    schema: z.number().int().min(7).max(730),
    default: 90,
  });
  settings.define({
    key: 'docs.compactThreshold',
    schema: z.number().int().min(50).max(10_000),
    default: 500,
  });
}
