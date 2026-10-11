import type { RoadmapItem } from '@bemmoly/module-work/shared';
import {
  epicColor,
  epicFill,
  ForecastChip,
  forecastWords,
  KeyChip,
  StatusGlyph,
  statusStage,
  TimelineBar,
  type TimelineGrip,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { KeyboardEvent, ReactNode } from 'react';
import { childBar } from '../hooks/roadmap-bars.ts';
import type { RoadmapRow } from '../hooks/roadmap-model.ts';
import { datesWords } from '../hooks/roadmap-schedule.ts';
import { cx } from '../issue/cx.ts';
import { useRoadmapRow } from './roadmap-context.ts';

/*
 * One row of the timeline: the sticky name cell, then its lane. Reading order follows the
 * row, so a screen reader hears the name, then the bar. Name cells and bars carry
 * data-roadmap-cell and data-row, so the arrow keys move between rows in the same column.
 */

const NAME_CELL =
  'sticky left-0 z-2 flex h-full w-75 shrink-0 items-center gap-2 border-r border-line bg-canvas pr-3 pl-2 max-md:w-33 max-md:pr-2';

const nameButton =
  'min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-sans text-13 text-tx hover:underline focus-ring rounded-chip';

function metaOf(item: RoadmapItem, personName: (id: string) => string | null): string {
  const { total, done } = item.progress;
  const issues = `${total} ${total === 1 ? 'issue' : 'issues'}`;
  const pct = total === 0 ? null : `${Math.round((done / total) * 100)}% done`;
  const people = item.assigneeIds.flatMap((id) => personName(id) ?? []).slice(0, 2);
  const when = item.start || item.end ? null : 'No dates';
  return [issues, pct, people.join(', ') || null, when].filter(Boolean).join(' · ');
}

function Toggle({ item, open, index }: { item: RoadmapItem; open: boolean; index: number }) {
  const { toggle } = useRoadmapRow();
  if (item.children.length === 0) return <span aria-hidden className="w-5 shrink-0" />;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${open ? 'Hide' : 'Show'} the issues in ${item.title}`}
      data-row={index}
      onClick={() => toggle(item.id)}
      className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-chip border-0 bg-transparent p-0 text-tx-3 hover:bg-hover focus-ring"
    >
      <Icon
        name="chevron"
        size={14}
        className={cx('motion-safe:transition-transform', open && 'rotate-90')}
      />
    </button>
  );
}

function ItemName({ item, open, index }: { item: RoadmapItem; open: boolean; index: number }) {
  const shared = useRoadmapRow();
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && !open && item.children.length > 0) shared.toggle(item.id);
    else if (event.key === 'ArrowLeft' && open) shared.toggle(item.id);
    else return;
    event.preventDefault();
  };
  return (
    <div className={NAME_CELL}>
      <Toggle item={item} open={open} index={index} />
      {item.kind === 'epic' ? (
        <i
          aria-hidden
          className={cx('size-2.5 shrink-0 rounded-tick', epicFill(epicColor(item.color, item.id)))}
        />
      ) : (
        <Icon name="releases" size={14} className="shrink-0 text-tx-3" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            data-roadmap-cell="name"
            data-row={index}
            data-item-id={item.id}
            onClick={() => shared.open(item)}
            onKeyDown={onKeyDown}
            className={cx(nameButton, 'font-medium')}
            title={item.title}
          >
            {item.title}
          </button>
          {item.key && !shared.narrow && <KeyChip issueKey={item.key} />}
        </span>
        {!shared.narrow && (
          <span className="truncate text-12 text-tx-3 tabular-nums">
            {metaOf(item, shared.personName)}
          </span>
        )}
      </div>
      {!shared.narrow && (
        <ForecastChip
          state={item.forecast.state}
          daysLate={item.forecast.daysLate}
          label={`${item.title} forecast`}
          onClick={() => shared.openForecast(item)}
        />
      )}
    </div>
  );
}

function ItemLane({ item, index }: { item: RoadmapItem; index: number }) {
  const shared = useRoadmapRow();
  const place = shared.bars.get(item.id);
  const { schedule, today } = shared;
  if (!place) return null;
  const draft = schedule.drafts.get(item.id);
  const base = { start: place.dates.start, end: place.dates.end };
  const pct = item.progress.total === 0 ? 0 : (item.progress.done / item.progress.total) * 100;
  const words = forecastWords(item.forecast.state, item.forecast.daysLate);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const grip: TimelineGrip = event.altKey ? 'end' : 'move';
    const by = (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 7 : 1);
    schedule.nudge(item, base, grip, by);
  };
  return (
    <TimelineBar
      left={place.left}
      width={place.width}
      tone={item.kind === 'epic' ? epicColor(item.color, item.id) : 'neutral'}
      label={item.title}
      progress={pct}
      late={place.late}
      range={place.range}
      milestone={item.kind === 'version'}
      openStart={place.openStart}
      ghost={place.ghost}
      movable={item.canSchedule}
      pending={schedule.pending.has(item.id)}
      dragging={schedule.dragging === item.id}
      hint={draft ? datesWords(draft, today) : null}
      aria-label={`${item.title}, ${datesWords(place.dates, today)}, ${Math.round(pct)}% done, ${words}`}
      {...(item.canSchedule
        ? {
            'aria-describedby': shared.instructionsId,
            'aria-keyshortcuts':
              'ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight Alt+ArrowLeft Alt+ArrowRight F',
          }
        : {})}
      onGrab={(grip, event) => schedule.grab(item, base, grip, event)}
      onKeyDown={onKeyDown}
      onClick={() => {
        if (!schedule.consumeDrag()) shared.open(item);
      }}
      data-roadmap-cell="bar"
      data-row={index}
      data-item-id={item.id}
    />
  );
}

function Lane({ children, width }: { children?: ReactNode; width: number }) {
  return (
    <div className="relative h-full shrink-0" style={{ width }}>
      {children}
    </div>
  );
}

export function RoadmapRowView({
  row,
  index,
  label,
}: {
  row: RoadmapRow;
  index: number;
  label: ReactNode;
}) {
  const shared = useRoadmapRow();
  const width = shared.scale.width;
  if (row.kind === 'group') {
    return (
      <div className="flex h-8 border-b border-line-2 bg-sunken">
        <div className={cx(NAME_CELL, 'bg-sunken')}>{label}</div>
        <Lane width={width} />
      </div>
    );
  }
  if (row.kind === 'child') {
    const bar = childBar(row.child, shared.scale);
    const tone = epicColor(row.parent.color, row.parent.id);
    return (
      <div className="flex h-8 border-b border-line-2">
        <div className={cx(NAME_CELL, 'pl-10 text-12 max-md:pl-6')}>
          <StatusGlyph
            stage={statusStage(row.child.statusCategory, row.child.statusName)}
            label={row.child.statusName}
            size={12}
          />
          {!shared.narrow && <KeyChip issueKey={row.child.key} />}
          <button
            type="button"
            data-roadmap-cell="name"
            data-row={index}
            onClick={() => shared.openIssue(row.child.key)}
            className={cx(nameButton, 'text-12 text-tx-2')}
            title={row.child.title}
          >
            {row.child.title}
          </button>
        </div>
        <Lane width={width}>
          {bar && (
            <TimelineBar
              left={bar.left}
              width={bar.width}
              tone={tone}
              size="child"
              tabIndex={-1}
              aria-label={`${row.child.key} ${row.child.title}`}
              onClick={() => shared.openIssue(row.child.key)}
            />
          )}
        </Lane>
      </div>
    );
  }
  return (
    <div className="group/row flex h-11 border-b border-line-2">
      <ItemName item={row.item} open={row.open} index={index} />
      <Lane width={width}>
        <ItemLane item={row.item} index={index} />
      </Lane>
    </div>
  );
}
