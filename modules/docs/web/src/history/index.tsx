import { preloadable, useLoaded } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { Suspense } from 'react';
import type { HistoryPanelProps } from './history-panel.tsx';

/*
 * The version history slot: <HistoryPanel pageId canEdit /> for the side panel. The list,
 * the compare view and its diff renderer load in their own chunk on first open.
 */

// Loaded before it renders (useLoaded), so no Suspense fallback holds it back 300 ms.
const Panel = preloadable<HistoryPanelProps>(() =>
  import('./history-panel.tsx').then((m) => ({ default: m.HistoryPanel })),
);

const skeleton = (
  <div className="flex flex-col gap-2 p-3.5" aria-hidden>
    <Skeleton width="40%" />
    <Skeleton width="75%" />
  </div>
);

export function HistoryPanel(props: HistoryPanelProps) {
  const ready = useLoaded(Panel);
  return (
    <Suspense fallback={skeleton}>{ready ? <Panel.Component {...props} /> : skeleton}</Suspense>
  );
}

export type { HistoryPanelProps };
