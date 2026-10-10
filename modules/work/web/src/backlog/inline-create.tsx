import { Input, IssueCreateRow } from '@bemmoly/ui';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useBacklogUi } from '../hooks/backlog-store.ts';

export interface InlineCreateProps {
  containerId: string;
  /** Creates the issue; resolves when it is saved, rejects with the server's reason. */
  onCreate: (title: string) => Promise<unknown>;
  disabled?: boolean;
}

/**
 * "+ Create issue" at the foot of a container, which becomes a title field
 * in place: Enter saves and keeps the field open for the next one, Escape
 * or an empty blur closes it.
 */
export function InlineCreate({ containerId, onCreate, disabled }: InlineCreateProps) {
  const open = useBacklogUi((state) => state.creatingIn === containerId);
  const setCreatingIn = useBacklogUi((state) => state.setCreatingIn);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <IssueCreateRow
        onCreate={() => {
          setError(null);
          setCreatingIn(containerId);
        }}
      />
    );
  }

  const close = () => {
    setTitle('');
    setError(null);
    setCreatingIn(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = title.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      await onCreate(text);
      setTitle('');
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The issue was not created');
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-1 border-b border-line-2 py-1.5 pr-6 pl-10"
    >
      <Input
        autoFocus
        aria-label="New issue title"
        placeholder="What needs to be done? Enter to create, Escape to close"
        value={title}
        disabled={disabled}
        aria-busy={saving || undefined}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (!title.trim()) close();
        }}
      />
      {error && (
        <span role="alert" className="text-12 text-red-tx">
          {error}
        </span>
      )}
    </form>
  );
}
