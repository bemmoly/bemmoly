import type { DiscoveryStatus } from '@bemmoly/module-pipelines/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { platformKeys } from '../../api/platform.ts';
import { api } from '../../lib/api.ts';

/** How often step 2 looks again while repositories are being scanned. */
const POLL_MS = 2_000;
/** "No sweep yet", as a value a sweep's start can differ from. */
const NEVER = 'never';

/** When the last sweep started, NEVER before the first, null before the status loads. */
const lastStartOf = (status: DiscoveryStatus | undefined): string | null =>
  status ? (status.lastSweep?.startedAt ?? NEVER) : null;

/** Asked for, and no sweep newer than the one seen at the time has started yet. */
const isWaiting = (waitingPast: string | null, lastStart: string | null): boolean =>
  waitingPast !== null && (lastStart === null || lastStart === waitingPast);

export interface Discovery {
  status: DiscoveryStatus | null;
  /** A sweep is running, or one was asked for and has not started yet. */
  scanning: boolean;
  scanAgain: () => void;
}

/**
 * Discovery as step 2 follows it. Connecting GitHub is enough: if no sweep has run yet, one
 * is asked for at once instead of waiting for the next scheduled one (not once the catalog
 * has applications: `quiet`). The status is polled while scans run and the proposals
 * refresh as repositories finish. A sweep that was asked for counts as running until one
 * newer than the last starts, so no clocks are compared.
 */
export function useDiscovery(
  github: boolean | null,
  quiet: boolean,
  onRefused: (error: unknown) => void,
): Discovery {
  const client = useQueryClient();
  const [waitingPast, setWaitingPast] = useState<string | null>(null);
  const status = useQuery({
    queryKey: platformKeys.discovery(),
    queryFn: () => api.platform.discovery(),
    retry: false,
    refetchInterval: (query): number | false =>
      query.state.data?.scanning || isWaiting(waitingPast, lastStartOf(query.state.data))
        ? POLL_MS
        : false,
  });
  const lastStart = lastStartOf(status.data);
  const waiting = isWaiting(waitingPast, lastStart);
  const scan = useMutation({
    mutationFn: () => api.platform.scanAll(),
    onMutate: () => setWaitingPast(lastStart ?? NEVER),
    onError: () => setWaitingPast(null),
    onSettled: () => client.invalidateQueries({ queryKey: platformKeys.discovery() }),
  });
  const { mutate } = scan;

  const asked = useRef(false);
  useEffect(() => {
    if (quiet || github !== true || lastStart !== NEVER || asked.current) return;
    asked.current = true;
    mutate();
  }, [quiet, github, lastStart, mutate]);

  const scanned = status.data?.scanned;
  useEffect(() => {
    if (scanned === undefined) return;
    void client.invalidateQueries({ queryKey: platformKeys.proposals() });
  }, [client, scanned]);

  return {
    status: status.data ?? null,
    scanning: status.data?.scanning === true || waiting,
    // Only a scan someone asked for says it was refused; the first one is asked quietly.
    scanAgain: () => mutate(undefined, { onError: onRefused }),
  };
}
