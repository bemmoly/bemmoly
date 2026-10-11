import { Button } from '@bemmoly/ui';
import { useEffect, useRef } from 'react';
import { useColumnPageState } from '../hooks/board-load-more.ts';
import { useBoardShared } from './board-context.ts';

/**
 * The foot of a column with cards not loaded yet: its next page arrives as the foot scrolls
 * near, and the button reads it on demand, for the keyboard and when scrolling never comes.
 * A page that failed stops the scrolling reads and says so; the button tries again.
 */
export function ColumnMore({
  columnId,
  columnName,
  more,
  ready,
}: {
  columnId: string;
  columnName: string;
  /** Cards of the column not loaded yet. */
  more: number;
  /** Whether the cell already shows every card it has loaded, so the next page is next. */
  ready: boolean;
}) {
  const { loadMore } = useBoardShared();
  const state = useColumnPageState(columnId);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !ready || !loadMore || state !== null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore(columnId);
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, loadMore, state, columnId]);
  if (!loadMore) return null;
  return (
    <div ref={ref} className="flex flex-col items-center gap-1 pt-1">
      {state === 'failed' && (
        <p role="status" className="m-0 text-12 text-red-tx">
          The next cards did not load.
        </p>
      )}
      <Button
        variant="ghost"
        size="sm"
        loading={state === 'loading'}
        aria-label={`Show ${more} more in ${columnName}`}
        onClick={() => void loadMore(columnId)}
      >
        {state === 'failed' ? 'Try again' : `Show ${more} more`}
      </Button>
    </div>
  );
}
