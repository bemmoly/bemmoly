import { preloadable, useLoaded } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { Suspense } from 'react';
import type { HistoryModeProps } from './history-mode.tsx';

/*
 * The version history mode: <HistoryMode pageId canEdit onExit /> in the page's place. The
 * timeline, the compare and its diff renderer load in their own chunk on first open.
 */

// Loaded before it renders (useLoaded), so no Suspense fallback holds it back 300 ms.
const Mode = preloadable<HistoryModeProps>(() =>
  import('./history-mode.tsx').then((m) => ({ default: m.HistoryMode })),
);

const skeleton = (
  <div className="flex flex-1 flex-col gap-2 p-8" aria-hidden>
    <Skeleton width="40%" />
    <Skeleton width="75%" />
  </div>
);

export function HistoryMode(props: HistoryModeProps) {
  const ready = useLoaded(Mode);
  return (
    <Suspense fallback={skeleton}>{ready ? <Mode.Component {...props} /> : skeleton}</Suspense>
  );
}

export type { HistoryModeProps };
