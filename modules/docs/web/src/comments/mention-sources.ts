import type { EditorSources, SuggestionItem } from '@bemmoly/editor';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';

/** People shown for a bare "@", before anything is typed. */
const FIRST_PEOPLE = 8;

/**
 * What a comment box searches: @ finds the workspace's people through the server's user
 * search, so a mention names anyone, not only the hundred the Docs lists hold. Mentioned
 * people are notified by the server when the comment lands.
 */
export function useMentionSources(): EditorSources {
  return useMemo<EditorSources>(
    () => ({
      people: async (query, signal) => {
        const q = query.trim();
        const page = await api.users.list(
          { limit: FIRST_PEOPLE, status: 'active', ...(q ? { q } : {}) },
          { signal },
        );
        return page.items.map((user): SuggestionItem => ({
          id: user.id,
          label: user.name,
          description: user.email,
        }));
      },
    }),
    [],
  );
}
