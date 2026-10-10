import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';

const MARK = 'rounded-chip bg-amber-50 px-px text-tx';

/** Splits on the server's <b>…</b> into text and marks, never through innerHTML. */
function fromTags(text: string): ReactNode[] {
  return text.split(/(<b>.*?<\/b>)/g).map((part, index) =>
    part.startsWith('<b>') ? (
      <mark key={index} className={MARK}>
        {part.slice(3, -4)}
      </mark>
    ) : (
      part
    ),
  );
}

/** Marks each place the typed words appear, for a title the server sent plain. */
function fromQuery(text: string, query: string): ReactNode[] {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (words.length === 0) return [text];
  return text.split(new RegExp(`(${words.join('|')})`, 'gi')).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className={MARK}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** A title or a matching line with the hits marked. */
export function Marked({ text, query }: { text: string; query?: string }) {
  return <>{query === undefined ? fromTags(text) : fromQuery(text, query)}</>;
}

/** "In Engineering ×": the place the search keeps to until it is cleared. */
export function PlaceChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-acc/30 bg-acc-50 pr-1 pl-2.5 text-12 font-medium text-acc">
      In {label}
      <button
        type="button"
        aria-label={`Search everywhere, not only in ${label}`}
        onClick={onClear}
        className="grid size-4 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-acc hover:bg-acc/15"
      >
        <Icon name="close" size={11} />
      </button>
    </span>
  );
}
