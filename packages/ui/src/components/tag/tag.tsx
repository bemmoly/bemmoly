import type { HTMLAttributes } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type TagSize = 'sm' | 'md' | 'lg';

/**
 * sm: card and detail labels (11px, 2px 6px, 3px radius). md: team chips in People (11.5px,
 * 2px 7px). lg: doc metadata and email chips (12.5px, 3px 8px, 4px radius).
 */
const SIZES: Record<TagSize, string> = {
  sm: 'rounded-chip px-1.5 py-0.5 text-11',
  md: 'rounded-chip px-1.75 py-0.5 text-12',
  lg: 'rounded-chip px-2 py-0.75 text-13',
};

const TONES = {
  neutral: 'bg-line-2 text-tx-2',
  accent: 'bg-acc-50 font-medium text-acc',
} as const;

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  size?: TagSize;
  tone?: keyof typeof TONES;
  /** Adds a remove button; the label names what is removed. */
  onRemove?: () => void;
  removeLabel?: string;
}

export function Tag({
  size = 'sm',
  tone = 'neutral',
  onRemove,
  removeLabel,
  className,
  children,
  ...rest
}: TagProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap',
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove ${typeof children === 'string' ? children : 'tag'}`}
          className={cx(
            '-mr-0.5 cursor-pointer border-0 bg-transparent p-0 text-tx-3 hover:text-tx-2',
            focusRing,
          )}
        >
          <Icon name="close" size={9} />
        </button>
      )}
    </span>
  );
}
