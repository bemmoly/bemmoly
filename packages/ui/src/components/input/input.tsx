import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';

export type InputSize = 'md' | 'lg';

/** The control box: 32px with 10px padding (search boxes, Board Settings) or 36px with 12px (Setup form). */
const SIZES: Record<InputSize, string> = {
  md: 'h-control px-2.5 gap-2',
  lg: 'h-9 px-3 gap-2',
};

/** Shared by Input, Textarea and Select: the mock's bordered control and its focus state. */
export const controlClass = cx(
  'rounded-control border border-br3 text-13 text-tx',
  'focus-ring-within focus-within:border-acc',
  'has-disabled:cursor-not-allowed has-disabled:opacity-50',
);

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  size?: InputSize;
  /**
   * `subtle` is the top bar search box on the bg2 surface. `recessed` is the Setup URL field: the
   * read-only look on a value that stays editable, for a field that is filled in for you.
   */
  tone?: 'default' | 'subtle' | 'recessed';
  /** Leading content, such as the search glyph. */
  prefix?: ReactNode;
  /** Trailing content, such as a key hint. */
  suffix?: ReactNode;
  /** Monospace value, as for URLs and hosts in Setup. */
  mono?: boolean;
  ref?: Ref<HTMLInputElement>;
  wrapperClassName?: string;
}

export function Input({
  size = 'md',
  tone = 'default',
  prefix,
  suffix,
  mono,
  readOnly,
  className,
  wrapperClassName,
  ref,
  ...rest
}: InputProps) {
  const surface =
    readOnly || tone === 'recessed' ? 'bg-sf2 text-tx3' : tone === 'subtle' ? 'bg-bg2' : 'bg-sf';
  return (
    <div className={cx('flex items-center', SIZES[size], controlClass, surface, wrapperClassName)}>
      {prefix}
      <input
        ref={ref}
        readOnly={readOnly}
        data-autofocus={rest.autoFocus ? '' : undefined}
        className={cx(
          'h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-inherit outline-0 placeholder:text-tx5',
          mono ? 'font-mono text-12h' : 'font-sans text-13',
          className,
        )}
        {...rest}
      />
      {suffix}
    </div>
  );
}

export interface SearchInputProps extends Omit<InputProps, 'prefix' | 'type'> {
  /** Key hint at the end, such as "/" in the top bar. */
  hint?: string;
}

/** Search box: ⌕ at 14px, placeholder in tx5 and an optional mono key hint in tx6. */
export function SearchInput({ hint, suffix, ...rest }: SearchInputProps) {
  return (
    <Input
      type="search"
      prefix={<Icon name="search" className="text-tx5" />}
      suffix={
        suffix ??
        (hint ? (
          <kbd className="ml-auto font-mono text-11 font-medium text-tx6">{hint}</kbd>
        ) : undefined)
      }
      {...rest}
    />
  );
}
