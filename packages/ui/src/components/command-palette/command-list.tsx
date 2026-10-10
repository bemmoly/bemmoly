import { useId, type ReactNode } from 'react';
import { Icon, type IconName } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Kbd } from '../kbd/kbd.tsx';
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
      className="flex max-h-[min(440px,60vh)] flex-col overflow-auto p-1.5"
    >
      {children}
    </div>
  );
}

/** A labelled group: the label once, 11px semibold in the muted ink, never repeated per row. */
export function CommandGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <div id={id} className="px-3.5 pt-2.5 pb-1 text-11 font-semibold text-tx-3">
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
  /** Right side: "In review · Aisha", a status glyph. */
  meta?: ReactNode;
  /** The shortcut that does the same, drawn as keys: "C", "G B". */
  keys?: string;
  onSelect: () => void;
}

/** A 38px result row with its own icon; the active row takes the hover overlay (the palette sets it). */
export function CommandItem({ icon, issueKey, title, meta, keys, onSelect }: CommandItemProps) {
  const id = useId();
  return (
    <div
      id={id}
      role="option"
      aria-selected="false"
      onClick={onSelect}
      className="flex h-9.5 shrink-0 cursor-pointer items-center gap-2.5 rounded-card px-3.5 text-tx aria-selected:bg-hover motion-safe:transition-colors motion-safe:duration-(--duration-instant)"
    >
      <span aria-hidden className="grid w-4.5 shrink-0 place-items-center text-tx-2">
        {icon}
      </span>
      {/* A key column wide enough for PLT-1234, so the titles of mixed projects line up. */}
      {issueKey && (
        <span className="min-w-15 shrink-0 font-mono text-11 font-medium text-tx-3">
          {issueKey}
        </span>
      )}
      <span
        className="min-w-0 flex-1 truncate"
        title={typeof title === 'string' ? title : undefined}
      >
        {title}
      </span>
      {meta && <span className="flex shrink-0 items-center gap-1.5 text-12 text-tx-3">{meta}</span>}
      {keys && (
        <span className="flex shrink-0 gap-1">
          {keys.split(' ').map((key, index) => (
            <Kbd key={index} keys={key} />
          ))}
        </span>
      )}
    </div>
  );
}

/** The 16px tiles for docs, settings and actions: an icon, or a person's initial. */
export function CommandGlyph({
  icon,
  letter,
  tone = 'neutral',
  round,
}: {
  icon?: IconName;
  letter?: string;
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
      {icon ? <Icon name={icon} size={11} /> : letter}
    </span>
  );
}
