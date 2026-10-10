import { labelNameSchema } from '@bemmoly/module-docs/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Label, useToast } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useId, useState, type KeyboardEvent } from 'react';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { PROP } from '../body/property.tsx';
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
 * The page's labels in the properties row, as outlined Label pills that remove on their ×,
 * and a field that adds one on Enter or comma, suggesting names other pages use so a space
 * keeps one spelling of "rfc". Read-only pages list them.
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
  const toast = useToast();
  const remove = (label: string) => {
    const before = labels;
    setLabels.mutate(
      labels.filter((item) => item !== label),
      {
        onSuccess: () =>
          toast.undo({
            title: `Label “${label}” removed`,
            onUndo: () => setLabels.mutate([...before]),
          }),
      },
    );
  };
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
      <span className={PROP}>
        {labels.map((label) => (
          <Label key={label} name={label} />
        ))}
      </span>
    ) : null;
  }

  const offered = (suggestions.data ?? [])
    .map((usage) => usage.name)
    .filter((name) => !labels.includes(name));
  return (
    <span
      role="group"
      aria-label="Labels"
      className="inline-flex flex-wrap items-center gap-1 px-1"
    >
      {labels.map((label) => (
        <Label key={label} name={label} onRemove={() => remove(label)} />
      ))}
      {draft === null ? (
        labels.length < MAX_LABELS && (
          <button
            type="button"
            onClick={() => setDraft('')}
            aria-label="Add label"
            className={PROP}
          >
            <Icon name="tag" size={13} className="text-tx-3" />
            {labels.length === 0 && <span className="text-tx-3">Add label</span>}
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
            className="h-6 w-28 rounded-control border border-acc bg-canvas px-1.5 font-sans text-12 text-tx shadow-ring outline-0"
          />
          <datalist id={listId}>
            {offered.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </>
      )}
    </span>
  );
}
