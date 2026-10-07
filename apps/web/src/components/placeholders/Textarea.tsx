import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { FIELD_CLASS } from './Input.tsx';

/** PLACEHOLDER for @bemmoly/ui Textarea: the 80px paste box of the Setup mock's invite step. */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`${FIELD_CLASS} min-h-20 px-3 py-2.5 font-sans text-small leading-normal ${
        invalid ? 'border-danger' : 'border-br3'
      } ${className ?? ''}`}
      {...rest}
    />
  );
});
