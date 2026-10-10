import { labelNameSchema } from '@bemmoly/module-docs/shared';
import { Tag } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useId, useState, type KeyboardEvent } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { usePageScreen } from '../screen-context.ts';
import { useSetLabels } from '../use-page-actions.ts';

const MAX_LABELS = 30;

/** Names already used across the workspace, for the field's suggestions. */
function useLabelSuggestions(query: string, enabled: boolean) {
  return useQuery({
    queryKey: [...docsKeys.all(), 'labels', query],
    queryFn: () => api.docs.labels.suggest({ q: query, limit: 8 }),
    enabled,
    staleTime: 60_000,
  });
}

/**
 * The page's labels as removable tags and a field that adds one on Enter or comma, suggesting
 * names other pages use so a space keeps one spelling of "rfc". Read-only pages list them.
 */
export function LabelsField() {
  const { page, editable } = usePageScreen();
  const setLabels = useSetLabels(page.id);
  const [draft, setDraft] = useState<string | null>(null);
  const query = useDeferredValue(draft?.trim() ?? '');
  const suggestions = useLabelSuggestions(query, draft !== null);
  const listId = useId();
  const labels = page.labels;

  const add = (raw: string) => {
    const parsed = labelNameSchema.safeParse(raw);
    setDraft('');
    if (!parsed.success || labels.includes(parsed.data) || labels.length >= MAX_LABELS) return;
    setLabels.mutate([...labels, parsed.data]);
  };
  const remove = (label: string) => setLabels.mutate(labels.filter((item) => item !== label));
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      if (draft?.trim()) add(draft);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(null);
    } else if (event.key === 'Backspace' && !draft && labels.length > 0) {
      remove(labels.at(-1)!);
    }
  };

  if (!editable) {
    return labels.length ? (
      labels.map((label) => <Tag key={label}>{label}</Tag>)
    ) : (
      <span className="text-tx5">None</span>
    );
  }

  const offered = (suggestions.data ?? [])
    .map((usage) => usage.name)
    .filter((name) => !labels.includes(name));
  return (
    <>
      {labels.map((label) => (
        <Tag key={label} onRemove={() => remove(label)} removeLabel={`Remove label ${label}`}>
          {label}
        </Tag>
      ))}
      {draft === null ? (
        labels.length < MAX_LABELS && (
          <button
            type="button"
            onClick={() => setDraft('')}
            className="cursor-pointer rounded-xs border-0 bg-transparent px-1 py-0.5 font-sans text-12h font-medium text-ac hover:text-ac-d focus-visible:shadow-ring focus-visible:outline-0"
          >
            + Add label
          </button>
        )
      ) : (
        <>
          <input
            aria-label="New label"
            list={listId}
            autoFocus
            value={draft}
            maxLength={60}
            placeholder="Label"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (draft.trim()) add(draft);
              setDraft(null);
            }}
            className="h-6 w-28 rounded-xs border border-ac bg-sf px-1.5 font-sans text-12h text-tx shadow-ring outline-0"
          />
          <datalist id={listId}>
            {offered.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </>
      )}
    </>
  );
}
