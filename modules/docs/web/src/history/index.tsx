import { Skeleton } from '@bemmoly/ui';
import { lazy, Suspense } from 'react';
import type { HistoryPanelProps } from './history-panel.tsx';

/*
 * The version history slot: <HistoryPanel pageId canEdit /> for the side panel. The list,
 * the compare view and its diff renderer load in their own chunk on first open.
 */

const Panel = lazy(() => import('./history-panel.tsx').then((m) => ({ default: m.HistoryPanel })));

export function HistoryPanel(props: HistoryPanelProps) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-2 p-3.5" aria-hidden>
          <Skeleton width="40%" />
          <Skeleton width="75%" />
        </div>
      }
    >
      <Panel {...props} />
    </Suspense>
  );
}

export type { HistoryPanelProps };
