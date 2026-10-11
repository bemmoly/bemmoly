import type { RoadmapView } from '@bemmoly/module-work/shared';
import { DependencyLines, TimelineGrid, TimelineHeader } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { dependencyLines, scrollToToday } from '../hooks/roadmap-bars.ts';
import type { RoadmapRow } from '../hooks/roadmap-model.ts';
import { cx } from '../issue/cx.ts';
import { ProjectTile } from '../shared/project-tile.tsx';
import { useRoadmapRow } from './roadmap-context.ts';
import { RoadmapRowView } from './roadmap-row.tsx';

/*
 * The Roadmap's one scroll region: the date header sticks to the top, the name column to the
 * left, and the rows scroll under both. The week lines and dependency lines are one layer
 * each behind and over the lanes. ↑ ↓ and J K move between rows in the same column.
 */

/** The name column: 300px, 132px on phones (w-75, w-33). */
export const NAME_WIDTH = { wide: 300, narrow: 132 } as const;

const STEP: Record<string, 1 | -1> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };

function stepRows(event: KeyboardEvent<HTMLDivElement>, root: HTMLElement | null) {
  const by = STEP[event.key];
  const target = event.target as HTMLElement;
  const cell = target.getAttribute('data-roadmap-cell');
  if (!by || !cell || !root || event.altKey || event.metaKey || event.ctrlKey) return;
  const row = Number(target.getAttribute('data-row'));
  const cells = [...root.querySelectorAll<HTMLElement>('[data-roadmap-cell="name"]')];
  const rows = cells
    .map((element) => Number(element.getAttribute('data-row')))
    .sort((a, b) => a - b);
  const next = rows[rows.indexOf(row) + by];
  if (next === undefined) return;
  event.preventDefault();
  const same = root.querySelector<HTMLElement>(`[data-roadmap-cell="${cell}"][data-row="${next}"]`);
  const name = root.querySelector<HTMLElement>(`[data-roadmap-cell="name"][data-row="${next}"]`);
  (same ?? name)?.focus();
}

function GroupLabel({
  row,
  view,
}: {
  row: Extract<RoadmapRow, { kind: 'group' }>;
  view: RoadmapView;
}) {
  const { toggle } = useRoadmapRow();
  const project = view.projects.find((entry) => entry.id === row.projectId);
  return (
    <button
      type="button"
      aria-expanded={row.open}
      onClick={() => toggle(row.id)}
      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-chip border-0 bg-transparent p-0 text-left font-sans text-12 font-semibold text-tx focus-ring"
    >
      <Icon
        name="chevron"
        size={14}
        className={cx('text-tx-3 motion-safe:transition-transform', row.open && 'rotate-90')}
      />
      {project ? (
        <ProjectTile project={project} size={16} />
      ) : (
        <Icon name="people" size={14} className="text-tx-3" />
      )}
      <span className="truncate">{row.label}</span>
      <span className="font-normal text-tx-3 tabular-nums">{row.count}</span>
    </button>
  );
}

export interface RoadmapTimelineProps {
  view: RoadmapView;
  rows: readonly RoadmapRow[];
  tops: readonly number[];
  height: number;
  scrollerRef: RefObject<HTMLDivElement | null>;
  /** Changes when the axis does, so the view re-centres on today. */
  axisKey: string;
  summary: string;
}

export function RoadmapTimeline({
  view,
  rows,
  tops,
  height,
  scrollerRef,
  axisKey,
  summary,
}: RoadmapTimelineProps) {
  const shared = useRoadmapRow();
  const { scale, today, narrow } = shared;
  const name = narrow ? NAME_WIDTH.narrow : NAME_WIDTH.wide;
  const centred = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (centred.current === axisKey) return;
    centred.current = axisKey;
    scrollToToday(scrollerRef.current, scale, today);
  }, [axisKey, scale, today, scrollerRef]);
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => stepRows(event, scrollerRef.current),
    [scrollerRef],
  );
  const lines = dependencyLines(view.dependencies, rows, tops, shared.bars);
  return (
    <div
      ref={scrollerRef}
      onKeyDown={onKeyDown}
      className="relative min-h-0 flex-1 overflow-auto bg-canvas"
      data-testid="roadmap-timeline"
    >
      <div className="relative" style={{ width: name + scale.width, minHeight: '100%' }}>
        <div className="sticky top-0 z-3 flex border-b border-line bg-canvas">
          <div className="sticky left-0 z-1 flex w-75 shrink-0 items-end border-r border-line bg-canvas px-4 pb-1.5 text-12 text-tx-3 max-md:w-33 max-md:px-2">
            <span className="truncate">{summary}</span>
          </div>
          <TimelineHeader scale={scale} today={today} />
        </div>
        <div className="relative">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0"
            style={{ left: name, width: scale.width }}
          >
            <TimelineGrid scale={scale} today={today} />
          </div>
          <div role="list" aria-label="Roadmap">
            {rows.map((row, index) => (
              <div role="listitem" key={row.id} className="relative z-1">
                <RoadmapRowView
                  row={row}
                  index={index}
                  label={row.kind === 'group' ? <GroupLabel row={row} view={view} /> : null}
                />
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute top-0 z-1" style={{ left: name }}>
            <DependencyLines lines={lines} width={scale.width} height={height} />
          </div>
        </div>
      </div>
    </div>
  );
}
