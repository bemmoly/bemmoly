import { cloneElement, useId, type ReactElement, type ReactNode } from 'react';
import { describeError } from '../lib/errors.ts';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  className?: string;
  /** The control; receives id, aria-describedby and invalid. */
  children: ReactElement<Record<string, unknown>>;
}

/** Label over control, from the Setup mock: 500 weight label, 6px gap, 12px hint below. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className="font-medium text-tx">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, invalid: Boolean(error) })}
      {error ? (
        <span id={`${id}-error`} className="text-caption text-danger-fg">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-caption text-tx5">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** A failed request in plain words, with the request id for support. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const { message, requestId } = describeError(error);
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-tile border border-danger bg-danger-bg px-3 py-2.5 text-small leading-normal text-danger-fg"
    >
      <span>{message}</span>
      {requestId ? (
        <span className="font-mono text-mono opacity-80">Request id {requestId}</span>
      ) : null}
    </div>
  );
}

/** The tinted note from the Setup and Appearance mocks: a 7px dot and a sentence. */
export function Notice({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'warn';
}) {
  const look = tone === 'accent' ? 'border-ac-br bg-ac-bg2' : 'border-warn bg-warn-bg';
  return (
    <div
      className={`flex items-center gap-2.5 rounded-tile border px-3 py-2.5 text-small leading-normal text-tx2 ${look}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.75 shrink-0 rounded-full ${tone === 'accent' ? 'bg-ac' : 'bg-warn'}`}
      />
      <span>{children}</span>
    </div>
  );
}
