import type { BoardMetrics, BoardView, Project, Sprint } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { HeaderActions } from '@bemmoly/core-web';
import { Button, MetricSparkline, MetricTile, SprintProgress } from '@bemmoly/ui';
import { Fragment } from 'react';
import { navigateTo } from '../hooks/issue-navigation.ts';
import { BoardActionsMenu } from './board-actions-menu.tsx';

const DAY = 86_400_000;

const monthDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });

function sprintLine(sprint: Sprint, now: number) {
  const dates =
    sprint.startsAt && sprint.endsAt
      ? `${monthDay(sprint.startsAt)} – ${monthDay(sprint.endsAt)}`
      : null;
  const left = sprint.endsAt ? Math.ceil((Date.parse(sprint.endsAt) - now) / DAY) : null;
  const remaining =
    left === null
      ? null
      : left > 0
        ? `${left} ${left === 1 ? 'day' : 'days'} remaining`
        : 'Ends today';
  return { dates, remaining, goal: sprint.goal ? `Goal: ${sprint.goal}` : null };
}

/** Last four weeks of completions against the four before, as the Flow tile's "▲ 18%". */
export function flowTrend(history: readonly number[]): number | null {
  const recent = history.slice(-4).reduce((a, b) => a + b, 0);
  const before = history.slice(-8, -4).reduce((a, b) => a + b, 0);
  return before > 0 ? Math.round(((recent - before) / before) * 100) : null;
}

function Subtitle({ parts }: { parts: Array<{ text: string; strong?: boolean } | null> }) {
  const shown = parts.filter((part): part is { text: string; strong?: boolean } => part !== null);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-12 text-tx-3">
      {shown.map((part, index) => (
        <Fragment key={part.text}>
          {index > 0 && <span aria-hidden>·</span>}
          <span className={part.strong ? 'font-medium text-tx' : 'truncate'}>{part.text}</span>
        </Fragment>
      ))}
    </div>
  );
}

export interface BoardHeaderProps {
  project: Project;
  view: BoardView;
  metrics: BoardMetrics | undefined;
  sprint: Sprint | undefined;
  inFlight: number;
  /** Points on cards in progress: the blue part of the sprint bar. */
  doingPoints: number;
}

/**
 * The sprint or flow heading and the metrics strip, as the Board mock's top; the trail and the
 * board's ··· live in the frame's header.
 */
export function BoardHeader({
  project,
  view,
  metrics,
  sprint,
  inFlight,
  doingPoints,
}: BoardHeaderProps) {
  const kanban = project.method === 'kanban';
  const flow = metrics ?? view.metrics;
  const committed = flow.committedPoints;
  const completed = flow.completedPoints;
  const line = sprint ? sprintLine(sprint, Date.now()) : null;
  const history = flow.throughputHistory.slice(-7);
  const peak = Math.max(1, ...history);
  const trend = flowTrend(flow.throughputHistory);
  const cycle = flow.cycleTimeDays;
  const endsSoon = line?.remaining === 'Ends today' || line?.remaining === '1 day remaining';
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-6 max-md:h-auto max-md:flex-wrap max-md:px-4 max-md:py-3">
      <Icon
        name={kanban ? 'board' : 'target'}
        size={18}
        className={sprint || kanban ? 'shrink-0 text-acc' : 'shrink-0 text-tx-3'}
      />
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <h1 className="m-0 truncate text-15 font-semibold tracking-[-0.01em]">
            {kanban ? `${project.name} board` : (sprint?.name ?? 'No active sprint')}
          </h1>
          {!kanban && line?.remaining && (
            <span
              className={`inline-flex h-4.5 shrink-0 items-center gap-1 rounded-xs px-1.5 text-11 font-semibold ${endsSoon ? 'bg-amber-50 text-amber-tx' : 'bg-sunken text-tx-2'}`}
            >
              <Icon name="clock" size={12} />
              {line.remaining}
            </span>
          )}
        </div>
        <Subtitle
          parts={
            kanban
              ? [
                  { text: 'Continuous flow' },
                  { text: `${inFlight} in flight` },
                  cycle === null ? null : { text: `Avg cycle ${cycle.toFixed(1)} days` },
                  { text: `${Math.round(flow.throughputPerWeek)} done a week` },
                ]
              : line
                ? [line.dates ? { text: line.dates } : null, line.goal ? { text: line.goal } : null]
                : [{ text: 'Start one from the backlog' }]
          }
        />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-3.5 whitespace-nowrap max-md:ml-0 max-md:w-full">
        {kanban ? (
          <MetricTile
            label="Flow"
            childrenFirst
            {...(trend === null
              ? {}
              : {
                  value: (
                    <span className="inline-flex items-center gap-0.5">
                      <Icon
                        name={trend >= 0 ? 'arrow-up' : 'arrow-down'}
                        size={11}
                        label={trend >= 0 ? 'up' : 'down'}
                      />
                      {Math.abs(trend)}%
                    </span>
                  ),
                  valueTone: trend >= 0 ? 'ok' : 'warn',
                })}
          >
            <MetricSparkline
              values={history.map((value) => (value / peak) * 100)}
              label={`Completed per week, last ${history.length} weeks`}
            />
          </MetricTile>
        ) : (
          sprint && (
            <div className="text-right max-md:flex-1 max-md:text-left">
              <div className="text-12 tabular-nums">
                <b className="font-semibold">{completed}</b>{' '}
                <span className="text-tx-3">of {committed} points done</span>
              </div>
              <SprintProgress
                done={completed}
                doing={doingPoints}
                total={committed}
                className="mt-1 w-40 max-md:w-full"
              />
            </div>
          )
        )}
        {!kanban && sprint && (
          <Button onClick={() => navigateTo(`/work/backlog/${project.key}?complete=${sprint.id}`)}>
            Complete sprint
          </Button>
        )}
      </div>
      <HeaderActions>
        <BoardActionsMenu project={project} boardName={view.board.name} />
      </HeaderActions>
    </div>
  );
}
