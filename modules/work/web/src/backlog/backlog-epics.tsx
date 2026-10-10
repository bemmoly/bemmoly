import { EpicItem, EpicPanel, Input } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { EpicsSkeleton } from '../skeletons/backlog-skeleton.tsx';
import { epicMeta, epicPercent, type EpicLook } from './model.ts';

export interface BacklogEpicsProps {
  epics: readonly EpicLook[];
  /** The backlog is still loading: placeholder items, not "No open epics". */
  loading?: boolean;
  /** Creates an epic with this title; absent when the project has no epic type. */
  onCreate?: (title: string) => Promise<unknown>;
  className?: string;
}

/**
 * The quiet epics rail: each open epic in its stored colour with its
 * progress, picked to filter the list (it sets the Epic filter in the
 * address) and picked again to clear it. "+ Create" opens a title field at
 * the top of the list.
 */
export function BacklogEpics({ epics, loading = false, onCreate, className }: BacklogEpicsProps) {
  const { filters, toggle } = useIssueFilters();
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
    <EpicPanel
      {...(onCreate ? { onCreate: () => setCreating(true) } : {})}
      {...(className ? { className } : {})}
    >
      {creating && (
        <form onSubmit={submit} className="flex flex-col gap-1 px-1 pb-2">
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
            <span role="alert" className="text-12 text-red-tx">
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
          selected={filters.epic.includes(epic.id)}
          onSelect={() => toggle('epic', epic.id)}
        />
      ))}
      {loading && <EpicsSkeleton />}
      {!loading && epics.length === 0 && !creating && (
        <p className="m-0 px-1 py-2 text-12 text-tx-3">
          No open epics. Create one to group related issues.
        </p>
      )}
    </EpicPanel>
  );
}
