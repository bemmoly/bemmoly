import { Button, Kbd } from '@bemmoly/ui';
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { describeError } from '../../lib/errors.ts';

/** What every step needs from the wizard to draw its footer. */
export interface StepNav {
  label: string;
  counter: string;
  canSkip: boolean;
  canGoBack: boolean;
  next: () => void;
  skip: () => void;
  back: () => void;
}

/** Enter anywhere outside a field or a control sends the step, as Enter in a field does. */
function isLoose(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  return !target.closest('input, textarea, select, button, a, [role="radio"], [contenteditable]');
}

interface StepFormProps {
  /** The step's primary action; a pending one is never sent twice. */
  onSubmit: () => void;
  busy?: boolean;
  children: ReactNode;
  label: string;
}

/**
 * A step is one form, so Enter in any field advances it. Enter with nothing focused does the
 * same; Esc does nothing destructive (it only closes what is open).
 */
export function StepForm({ onSubmit, busy, children, label }: StepFormProps) {
  const ref = useRef<HTMLFormElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if (!isLoose(event.target)) return;
      event.preventDefault();
      ref.current?.requestSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busyRef.current) return;
    onSubmit();
  };
  return (
    <form
      ref={ref}
      noValidate
      aria-label={label}
      aria-busy={busy || undefined}
      onSubmit={submit}
      onKeyDown={(event) => {
        // Enter in a search box searches; it never sends the step.
        const target = event.target as HTMLElement;
        if (event.key === 'Enter' && target.matches('input[type="search"]')) event.preventDefault();
      }}
      className="flex flex-col gap-5"
    >
      {children}
    </form>
  );
}

interface StepFooterProps {
  nav: StepNav;
  /** Overrides the step's label, e.g. "Send 3 invitations". */
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  /** A failed save: said in plain words, with Retry (the same submit). */
  error?: unknown;
}

/**
 * Every step's footer: Back on the left, then "Skip for now" where skipping is allowed and the
 * primary on the right. The primary shows progress while saving and is the Enter target.
 */
export function StepFooter({ nav, label, disabled, loading, error }: StepFooterProps) {
  const failure = error ? describeError(error) : null;
  return (
    <div className="flex flex-col gap-3 pt-1">
      {failure ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-red bg-red-50 px-3.5 py-2.5 text-13 text-red-tx"
        >
          <span className="min-w-0 flex-1">
            {failure.message} Nothing was lost; try again when you are ready.
          </span>
          <Button type="submit" variant="secondary" size="sm" loading={loading}>
            Retry
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2 border-t border-line pt-4">
        {nav.canGoBack ? (
          <Button type="button" variant="ghost" onClick={nav.back}>
            Back
          </Button>
        ) : null}
        <span className="ml-auto hidden items-center gap-1.5 text-12 text-tx-3 sm:flex">
          Press <Kbd keys="Enter" />
        </span>
        {nav.canSkip ? (
          <Button type="button" variant="ghost" onClick={nav.skip}>
            Skip for now
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={disabled}
          loading={loading}
          className="max-sm:ml-auto"
        >
          {label ?? nav.label}
        </Button>
      </div>
    </div>
  );
}
