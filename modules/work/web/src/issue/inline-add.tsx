import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState, type ReactNode } from 'react';
import { cx } from './cx.ts';

export interface InlineAddProps {
  /** "Add sub-issue". */
  label: string;
  placeholder: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creates the item; the box stays open for the next one. A rejection keeps the text. */
  onSubmit: (text: string) => Promise<unknown>;
  /** Shown beside the box while it is open, such as a relation picker. */
  before?: ReactNode;
}

/**
 * The last row of a list: "+ Add sub-issue" that turns into a text box in place. Enter creates
 * and keeps the box for the next one; Escape or an empty blur closes it.
 */
export function InlineAdd({
  label,
  placeholder,
  open,
  onOpenChange,
  onSubmit,
  before,
}: InlineAddProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const cancelled = useRef(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          onOpenChange(true);
        }}
        className="flex min-h-9 w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 text-left font-sans text-13 text-tx-3 hover:bg-hover hover:text-tx-2 focus-ring-inset"
      >
        <Icon name="plus" size={14} />
        {label}
      </button>
    );
  }

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setText('');
    } catch {
      // The caller says what went wrong; the text stays so nothing typed is lost.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-9 items-center gap-2 px-3 py-1">
      {before}
      <input
        aria-label={label}
        autoFocus
        value={text}
        disabled={busy}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onBlur={(event) => {
          // Moving to the relation picker beside the box keeps it open.
          if (event.currentTarget.parentElement?.contains(event.relatedTarget as Node)) return;
          if (!text.trim() && !cancelled.current) onOpenChange(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void submit();
          }
          if (event.key === 'Escape') {
            event.stopPropagation();
            cancelled.current = true;
            setText('');
            onOpenChange(false);
          }
        }}
        className={cx(
          'h-7 min-w-0 flex-1 border-0 bg-transparent font-sans text-13 text-tx outline-0 placeholder:text-tx-3',
          busy && 'opacity-60',
        )}
      />
    </div>
  );
}
