import { SkeletonText } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { describeError } from '../lib/errors.ts';

/** A failed request in plain words, with the request id for support. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const { message, requestId } = describeError(error);
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-control border border-red bg-side px-3 py-2.5 text-13 leading-body text-red-tx"
    >
      <span>{message}</span>
      {requestId ? (
        <span className="font-mono text-11 opacity-80">Request id {requestId}</span>
      ) : null}
    </div>
  );
}

/**
 * The tinted note from the Setup and Appearance mocks: a 7px dot and a
 * sentence. Accent for information, caution for something to fix.
 */
export function Notice({
  children,
  tone = 'accent',
}: {
  children: ReactNode;
  tone?: 'accent' | 'caution';
}) {
  const look = tone === 'accent' ? 'border-acc-100 bg-acc-50' : 'border-amber bg-amber-bg';
  return (
    <div
      className={`flex items-center gap-2.5 rounded-control border px-3 py-2.5 text-13 leading-body text-tx ${look}`}
    >
      <span
        aria-hidden="true"
        className={`size-1.75 shrink-0 rounded-full ${tone === 'accent' ? 'bg-acc' : 'bg-amber'}`}
      />
      <span>{children}</span>
    </div>
  );
}

/** Loading rows with a name for assistive technology. */
export function Loading({ label = 'Loading', lines = 3 }: { label?: string; lines?: number }) {
  return (
    <div role="status" aria-label={label} className="p-4">
      <SkeletonText lines={lines} />
    </div>
  );
}
