import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { useCommandContext } from './command-palette.tsx';

/** The results: up to 420px, scrolling. */
export function CommandList({
  children,
  label = 'Results',
}: {
  children: ReactNode;
  label?: string;
}) {
  const { listId } = useCommandContext();
  return (
    <div
      id={listId}
      role="listbox"
      aria-label={label}
      className="flex max-h-105 flex-col overflow-auto pb-1"
    >
      {children}
    </div>
  );
}

/** A labelled group: 11px tracked capitals in tx5, 10px 16px 4px. */
export function CommandGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <div
        id={id}
        className="px-4 pt-2.5 pb-1 text-11 font-medium tracking-caps text-tx5 uppercase"
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export interface CommandItemProps {
  /** A 16px glyph: TypeGlyph size 16, or a doc / action tile. */
  icon?: ReactNode;
  /** Issue key in mono, before the title. */
  issueKey?: string;
  title: ReactNode;
  /** Right side: "In review · Aisha", "⌘ N". */
  meta?: ReactNode;
  onSelect: () => void;
}

/** A result row: 8px 16px, 10px gaps; the active row is ac-bg (set by the palette). */
export function CommandItem({ icon, issueKey, title, meta, onSelect }: CommandItemProps) {
  const id = useId();
  return (
    <div
      id={id}
      role="option"
      aria-selected="false"
      onClick={onSelect}
      className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-tx aria-selected:bg-ac-bg motion-safe:transition-colors motion-safe:duration-(--duration-instant)"
    >
      {icon}
      {/* A key column wide enough for PLT-1234, so the titles of mixed projects line up. */}
      {issueKey && (
        <span className="min-w-15 shrink-0 font-mono text-11h font-medium text-tx4">
          {issueKey}
        </span>
      )}
      <span
        className="min-w-0 flex-1 truncate"
        title={typeof title === 'string' ? title : undefined}
      >
        {title}
      </span>
      {meta && <span className="shrink-0 text-12 text-tx5">{meta}</span>}
    </div>
  );
}

/** The 16px tiles the Command mock uses for docs (≡) and actions (+, ⚙). */
export function CommandGlyph({
  glyph,
  tone = 'neutral',
  round,
}: {
  glyph: string;
  tone?: 'neutral' | 'accent' | 'ai';
  round?: boolean;
}) {
  const tones = {
    neutral: 'bg-tx4 text-on-solid',
    accent: 'bg-ac-fill text-on-ac',
    ai: 'bg-ai text-on-ac',
  };
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex size-4 shrink-0 items-center justify-center text-9 leading-none font-semibold',
        round ? 'rounded-full' : 'rounded-chip',
        tones[tone],
      )}
    >
      {glyph}
    </span>
  );
}
