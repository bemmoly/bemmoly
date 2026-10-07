import { forwardRef, type SelectHTMLAttributes } from 'react';

/**
 * PLACEHOLDER for @bemmoly/ui Select: the bordered "Member ▾" control from the
 * People and Setup mocks, on a native select so keyboard and screen readers work.
 */
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: 'md' | 'sm' | 'xs';
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
}

const SIZES = {
  md: 'h-9 pl-3 pr-7 text-base',
  sm: 'h-control pl-2.5 pr-6 text-base',
  xs: 'h-6.5 pl-2.25 pr-6 text-small font-medium rounded-small',
} as const;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'sm', options, className, ...rest },
  ref,
) {
  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <select
        ref={ref}
        className={`w-full cursor-pointer appearance-none rounded-control border border-br3 bg-sf font-sans text-tx outline-none focus:border-ac focus:shadow-select disabled:cursor-not-allowed disabled:opacity-60 ${SIZES[size]}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-micro text-tx5"
      >
        ▾
      </span>
    </span>
  );
});
