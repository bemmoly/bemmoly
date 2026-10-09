import { EpicItem, EpicPanel, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';
import { epicMeta, epicPercent, type EpicLook } from './model.ts';

export interface BacklogEpicsProps {
  epics: readonly EpicLook[];
  /** Creates an epic with this title; absent when the project has no epic type. */
  onCreate?: (title: string) => Promise<unknown>;
}

/**
 * The 260px epics panel: each open epic with its progress, picked to filter
 * the list and picked again to clear it. "+ Create" opens a title field at
 * the top of the list.
 */
export function BacklogEpics({ epics, onCreate }: BacklogEpicsProps) {
  const epicId = useBacklogUi((state) => state.filters.epicId);
  const setFilters = useBacklogUi((state) => state.setFilters);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!onCreate || !title.trim()) return;
    try {
      await onCreate(title.trim());
      setTitle('');
      setCreating(false);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The epic was not created');
    }
  };

  return (
    <EpicPanel {...(onCreate ? { onCreate: () => setCreating(true) } : {})}>
      {creating && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-1 border-b border-br-row px-3.5 py-2.5"
        >
          <Input
            autoFocus
            aria-label="New epic title"
            placeholder="Epic name"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCreating(false);
            }}
            onBlur={() => {
              if (!title.trim()) setCreating(false);
            }}
          />
          {error && (
            <span role="alert" className="text-12 text-danger">
              {error}
            </span>
          )}
        </form>
      )}
      {epics.map((epic) => (
        <EpicItem
          key={epic.id}
          name={epic.title}
          epicKey={epic.key}
          colorClassName={epic.colorClassName}
          progress={epicPercent(epic)}
          meta={epicMeta(epic)}
          selected={epicId === epic.id}
          onSelect={() => setFilters({ epicId: epicId === epic.id ? null : epic.id })}
        />
      ))}
      {epics.length === 0 && !creating && (
        <p className="m-0 px-3.5 py-3 text-12 text-tx5">
          No open epics. Create one to group related issues.
        </p>
      )}
    </EpicPanel>
  );
}
