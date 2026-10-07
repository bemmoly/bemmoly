import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

export interface FieldProps {
  label: ReactNode;
  /** Help under the control (12px, tx5), as in the Setup password field. */
  hint?: ReactNode;
  /** Replaces the hint and marks the control invalid. Say what happened and what to do next. */
  error?: ReactNode;
  /** One control; it receives id, aria-describedby and aria-invalid. */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
}

/** Label above a control with 6px between, from the Setup wizard forms. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: (children.props['id'] as string | undefined) ?? id,
        'aria-describedby': message ? messageId : undefined,
        'aria-invalid': error ? true : undefined,
      })
    : children;
  const controlId = (isValidElement(children) && (children.props['id'] as string)) || id;
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={controlId} className="font-medium text-tx">
        {label}
      </label>
      {control}
      {message && (
        <span id={messageId} className={cx('text-12', error ? 'text-danger' : 'text-tx5')}>
          {message}
        </span>
      )}
    </div>
  );
}
