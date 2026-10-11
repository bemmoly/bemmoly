import { Icon } from '@bemmoly/ui/icons';
import { useState, type FormEvent } from 'react';
import { create } from 'zustand';

/*
 * "New issue" at the foot of a column: a title field in place, created in this column and
 * this lane. Enter saves and keeps the field for the next one; Escape or an empty blur closes.
 */

interface CreatingState {
  cell: string | null;
  open(cell: string | null): void;
}

export const useColumnCreate = create<CreatingState>()((set) => ({
  cell: null,
  open: (cell) => set({ cell }),
}));

export interface ColumnCreateProps {
  cell: string;
  columnName: string;
  onCreate: (title: string) => Promise<unknown>;
  /** Out of the way while a card is carried, keeping a title being typed for after the drop. */
  hidden?: boolean;
}

export function ColumnCreate({ cell, columnName, onCreate, hidden = false }: ColumnCreateProps) {
  const open = useColumnCreate((state) => state.cell === cell);
  const setOpen = useColumnCreate((state) => state.open);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        hidden={hidden}
        onClick={() => setOpen(cell)}
        className="focus-ring flex h-8 w-full cursor-pointer items-center gap-1.5 rounded-card border-0 bg-transparent px-2 font-sans text-13 text-tx-3 opacity-0 group-hover/cell:opacity-100 hover:bg-hover hover:text-tx-2 focus-visible:opacity-100 motion-safe:transition-opacity pointer-coarse:opacity-100"
      >
        <Icon name="plus" size={14} />
        New issue
      </button>
    );
  }

  const close = () => {
    setTitle('');
    setError(null);
    setOpen(null);
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
      setError(failure instanceof Error ? failure.message : 'The issue was not created.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={submit}
      hidden={hidden}
      className="flex flex-col gap-1 rounded-card bg-card p-2 shadow-e1"
    >
      <textarea
        autoFocus
        rows={2}
        aria-label={`New issue in ${columnName}`}
        placeholder="What needs to be done?"
        value={title}
        aria-busy={saving || undefined}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void submit(event);
          }
        }}
        onBlur={() => {
          if (!title.trim()) close();
        }}
        className="w-full resize-none border-0 bg-transparent p-0 font-sans text-13 leading-card font-medium text-tx outline-none placeholder:font-normal placeholder:text-tx-3"
      />
      <span className="text-11 text-tx-3">
        {saving ? 'Creating…' : 'Enter to create · Esc to close'}
      </span>
      {error && (
        <span role="alert" className="text-12 text-red-tx">
          {error}
        </span>
      )}
    </form>
  );
}
