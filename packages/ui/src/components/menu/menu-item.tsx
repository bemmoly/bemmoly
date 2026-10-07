import { useId, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { useMenu } from './menu-context.ts';

export interface MenuItemProps {
  onSelect: () => void;
  children: ReactNode;
  /** Leading icon or glyph. */
  icon?: ReactNode;
  /** Trailing hint, such as a shortcut or a count. */
  hint?: ReactNode;
  disabled?: boolean;
  /** Destructive actions read in the danger colour. */
  tone?: 'default' | 'danger';
  /** Keep the menu open after choosing (toggles in a filter menu). */
  keepOpen?: boolean;
}

/** 8px 10px, 5px radius; the highlighted item is accent on ac-bg, medium weight. */
export function MenuItem({
  onSelect,
  children,
  icon,
  hint,
  disabled,
  tone = 'default',
  keepOpen,
}: MenuItemProps) {
  const { close } = useMenu();
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (disabled) return;
        onSelect();
        if (!keepOpen) close();
      }}
      className={cx(
        'flex w-full cursor-pointer items-center gap-2 rounded-sm border-0 bg-transparent px-2.5 py-2 text-left font-sans text-13 outline-0',
        tone === 'danger' ? 'text-danger' : 'text-tx',
        'hover:bg-bg2 focus:bg-ac-bg focus:font-medium focus:text-ac',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="text-12 font-normal text-tx5">{hint}</span>}
    </button>
  );
}

export interface MenuGroupProps {
  label: string;
  children: ReactNode;
  /** A rule above the label, between sections ("BLOCKS" under "AI" in the Doc Editor). */
  separated?: boolean;
}

/** A labelled section: 11px medium capitals in tx5, 6px 10px. */
export function MenuGroup({ label, children, separated }: MenuGroupProps) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col">
      <div
        id={id}
        className={cx(
          'px-2.5 py-1.5 text-11 font-medium tracking-caps text-tx5 uppercase',
          separated && 'mt-1 border-t border-br-row',
        )}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t border-br-row" />;
}
