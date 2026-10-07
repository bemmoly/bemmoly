import type { Ref, SelectHTMLAttributes } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { controlClass } from '../input/input.tsx';

export type SelectSize = 'sm' | 'md';

/**
 * md: the Board Settings "Starts on" select (32px, 10px padding, caret at the right edge).
 * sm: the People role select (26px, 9px padding, 5px radius, 12.5px medium).
 */
const SIZES: Record<SelectSize, { box: string; select: string }> = {
  md: { box: 'h-control', select: 'pl-2.5 pr-7 text-13' },
  sm: { box: 'h-6.5 rounded-sm', select: 'pl-2.25 pr-6 text-12h font-medium' },
};

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: readonly SelectOption[];
  size?: SelectSize;
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
  wrapperClassName?: string;
}

/** A native select, so keyboard, screen readers and mobile pickers work without extra code. */
export function Select({
  options,
  size = 'md',
  placeholder,
  className,
  wrapperClassName,
  ref,
  ...rest
}: SelectProps) {
  const s = SIZES[size];
  return (
    <div className={cx('relative inline-flex bg-sf', controlClass, s.box, wrapperClassName)}>
      <select
        ref={ref}
        className={cx(
          'h-full w-full cursor-pointer appearance-none border-0 bg-transparent font-sans text-inherit outline-0',
          s.select,
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="caret"
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-tx5"
      />
    </div>
  );
}
