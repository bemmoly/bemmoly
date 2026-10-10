import { Button, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError } from '../../lib/errors.ts';

/**
 * A settings page while it loads: two sections shaped like the loaded ones (a title bar, then
 * label and value rows), so the page does not jump when the data lands.
 */
export function SettingsSkeleton({ sections = 2, rows = 3 }: { sections?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading settings" aria-busy className="flex flex-col gap-6">
      {Array.from({ length: sections }, (_, section) => (
        <div key={section} aria-hidden className="overflow-hidden rounded-card bg-card shadow-e1">
          <div className="flex min-h-11 items-center border-b border-line-2 px-4">
            <Skeleton width={120} height={10} />
          </div>
          <div className="flex flex-col px-4 py-1.5">
            {Array.from({ length: rows }, (_, row) => (
              <div
                key={row}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4 border-b border-line-2 py-3.5 last:border-b-0"
              >
                <Skeleton width={`${50 + ((row * 17) % 30)}%`} height={9} />
                <Skeleton width={`${40 + ((row * 23) % 40)}%`} height={9} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A settings page whose data did not load: what happened in plain words, the request id for
 * support, and Retry, which asks again for every query on the page that failed.
 */
export function SettingsFailure({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { message, requestId } = describeError(error);
  const retry = async () => {
    if (onRetry) return onRetry();
    setBusy(true);
    try {
      await client.refetchQueries({ type: 'active', predicate: (q) => q.state.status === 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card bg-card px-5 py-5 shadow-e1 sm:flex-row sm:items-center"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-control bg-red-50 text-red-tx">
        <Icon name="warning" size={18} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="m-0 font-semibold text-tx">This page didn’t load</p>
        <p className="m-0 text-tx-2">{message}</p>
        {requestId ? (
          <p className="m-0 font-mono text-12 text-tx-3">Request id {requestId}</p>
        ) : null}
      </div>
      <Button icon={<Icon name="refresh" />} loading={busy} onClick={() => void retry()}>
        Retry
      </Button>
    </div>
  );
}
