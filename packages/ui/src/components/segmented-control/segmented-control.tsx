import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';

export type SegmentedSize = 'sm' | 'md';

/**
 * md: the Appearance Mode and Surfaces switches (chip track, 2px padding, segments fill the
 * width, 6px 0 padding, 5px radius, all medium). sm: the Activity switch (5px track radius,
 * 12px, segments 3px 9px with 4px radius, only the selected one medium).
 */
const SIZES: Record<
  SegmentedSize,
  { track: string; item: string; selected: string; idle: string }
> = {
  md: {
    track: 'rounded-control p-0.5',
    item: 'flex-1 rounded-chip py-1.5 text-center font-medium',
    selected: '',
    idle: '',
  },
  sm: {
    track: 'rounded-chip p-0.5 text-12',
    item: 'rounded-chip px-2.25 py-0.75 whitespace-nowrap',
    selected: 'font-medium',
    idle: 'font-normal',
  },
};

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
}

export interface SegmentedControlProps<V extends string> {
  options: readonly SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: SegmentedSize;
  /** Names the group for assistive tech, e.g. "Mode". */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  className?: string;
}

/** A radio group drawn as segments; arrow keys move and select, as radios do. */
export function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ...aria
}: SegmentedControlProps<V>) {
  const s = SIZES[size];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" {...aria} className={cx('flex bg-line-2', s.track, className)}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'cursor-pointer border-0 font-sans',
              s.item,
              selected
                ? cx('bg-card text-tx shadow-e1', s.selected)
                : cx('bg-transparent text-tx-3', s.idle),
              focusRing,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
