import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { PageIcon } from '../../icons/page-icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export interface TemplateChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
}

/** A template in the Docs home's Templates panel: 8px 10px, br border, 6px radius, 12.5px. */
export function TemplateChip({ children, className, ...rest }: TemplateChipProps) {
  return (
    <button
      type="button"
      className={cx(
        'cursor-pointer truncate rounded-control border border-br bg-sf px-2.5 py-2 text-left font-sans text-12h text-tx',
        'hover:border-br3 hover:bg-bg2 motion-safe:transition-colors',
        focusRing,
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export interface TemplateCardProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'title' | 'name'
> {
  name: ReactNode;
  description?: ReactNode;
  /** An emoji the template carries; the doc icon (or plus, for a blank page) otherwise. */
  icon?: string | null;
  blank?: boolean;
  /** "Engineering", "Product"; the template's group. */
  category?: ReactNode;
  selected?: boolean;
}

/**
 * A choice in the template picker. No mock shows the picker; it is the Templates panel's
 * chip grown to a card: the chip's border and radius, a 28px tile on chip, a 13px medium
 * name and a 12px description. The chosen card takes the selected-card ring.
 */
export function TemplateCard({
  name,
  description,
  icon,
  blank,
  category,
  selected = false,
  className,
  ...rest
}: TemplateCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'flex cursor-pointer items-start gap-2.5 rounded-card border bg-sf p-3 text-left font-sans',
        'motion-safe:transition-[border-color,box-shadow,background-color]',
        selected ? 'border-ac shadow-ring' : 'border-br hover:border-br3 hover:bg-bg2',
        focusRing,
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cx(
          'flex size-7 shrink-0 items-center justify-center rounded-sm',
          blank ? 'bg-ac-bg text-ac' : 'bg-chip text-tx4',
        )}
      >
        {blank ? <Icon name="plus" size={16} /> : <PageIcon value={icon} size={16} />}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-13 font-medium text-tx">{name}</span>
          {category && <span className="truncate text-11 text-tx5">{category}</span>}
        </span>
        {description && (
          <span className="line-clamp-2 text-12 leading-body text-tx4">{description}</span>
        )}
      </span>
    </button>
  );
}
