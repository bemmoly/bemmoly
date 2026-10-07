import { forwardRef, type InputHTMLAttributes } from 'react';

/** PLACEHOLDER for @bemmoly/ui Input: 36px fields from the Setup mock, 32px in toolbars. */
export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'sm';
  invalid?: boolean;
  mono?: boolean;
}

export const FIELD_CLASS =
  'w-full rounded-control border bg-sf text-tx outline-none placeholder:text-tx5 ' +
  'focus:border-ac focus:shadow-select disabled:bg-bg2 disabled:text-tx4 read-only:bg-head-bg';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', invalid, mono, className, ...rest },
  ref,
) {
  const sizing = size === 'md' ? 'h-9 px-3' : 'h-control px-2.5';
  const border = invalid ? 'border-danger' : 'border-br3';
  const font = mono ? 'font-mono text-small text-tx3' : 'font-sans text-base';
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${FIELD_CLASS} ${sizing} ${border} ${font} ${className ?? ''}`}
      {...rest}
    />
  );
});
