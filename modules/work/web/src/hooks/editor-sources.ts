import type { EditorSources, SuggestionItem } from '@bemmoly/editor';
import { ISSUE_KEY_PATTERN } from '@bemmoly/module-work/shared';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { api } from '../shared/api.ts';
import { workPaths } from './issue-navigation.ts';
import { usePeople } from './issue-people.ts';

/** People shown for a bare "@", before anything is typed. */
const FIRST_PEOPLE = 8;

/**
 * What Work's editors search: @ finds people through the same server search as the person
 * pickers, falling back to the first page already held for a bare "@"; # and typed keys link
 * issues to their page.
 */
export function useEditorSources(): EditorSources {
  const { people, loadOptions } = usePeople();
  const held = useRef(people);
  useLayoutEffect(() => {
    held.current = people;
  });

  return useMemo<EditorSources>(
    () => ({
      people: async (query, signal) => {
        if (!query.trim()) {
          return held.current
            .slice(0, FIRST_PEOPLE)
            .map((user) => ({ id: user.id, label: user.name, description: user.email }));
        }
        const options = await loadOptions(query, signal);
        return options.map((option): SuggestionItem => ({
          id: option.value,
          label: option.label,
          ...(option.description ? { description: option.description } : {}),
        }));
      },
      references: {
        pattern: ISSUE_KEY_PATTERN,
        hrefFor: workPaths.issue,
        label: 'Issues',
        search: async (query, signal) => {
          if (!query.trim()) return [];
          const hits = await api.work.issues.suggest(query.trim(), signal);
          return hits.map((hit) => ({ id: hit.key, label: hit.key, description: hit.title }));
        },
      },
    }),
    [loadOptions],
  );
}
