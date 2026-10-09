import type { Ref, TextareaHTMLAttributes } from 'react';
import { cx } from '../../lib/cx.ts';
import { controlClass } from '../input/input.tsx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: Ref<HTMLTextAreaElement>;
}

/** The Setup invite box: 80px minimum, 10px 12px padding, 6px radius. */
export function Textarea({ className, rows = 3, ref, ...rest }: TextareaProps) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      data-autofocus={rest.autoFocus ? '' : undefined}
      className={cx(
        controlClass,
        'block min-h-20 w-full resize-y bg-sf px-3 py-2.5 font-sans leading-body outline-0 placeholder:text-tx5',
        'focus:border-ac focus:shadow-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  );
}
