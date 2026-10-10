import { cx } from './cx.ts';
import { useEffect, useRef, useState } from 'react';

/**
 * A name renamed where it is shown: click or Enter turns it into a field, Enter or blur
 * saves, Escape puts it back. The new name shows at once; a failed save brings the old one
 * back through the refetch, and the caller toasts why.
 */
export function InlineName({
  value,
  label,
  editable,
  onRename,
  className,
}: {
  value: string;
  /** "Rename Story". */
  label: string;
  editable: boolean;
  onRename: (name: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  if (!editable) return <span className={cx('truncate', className)}>{value}</span>;
  if (!editing)
    return (
      <button
        type="button"
        title={`${label} (click to rename)`}
        aria-label={label}
        className={cx(
          '-mx-1 truncate rounded-chip px-1 text-left hover:bg-hover',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc',
          className,
        )}
        onClick={() => setEditing(true)}
      >
        {value}
      </button>
    );
  const commit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== value) onRename(name);
  };
  return (
    <input
      ref={input}
      aria-label={label}
      value={draft}
      maxLength={60}
      className={cx(
        '-mx-1 h-6 min-w-0 rounded-chip border border-acc bg-card px-1 text-tx outline-none',
        className,
      )}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          event.stopPropagation();
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}
