import type { BoardMetrics, BoardView, Project, Sprint } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Breadcrumbs, Button, MetricSparkline, MetricTile, ProgressBar } from '@bemmoly/ui';
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
    <div className="flex flex-wrap items-center gap-2 text-12h text-tx4">
      {shown.map((part, index) => (
        <Fragment key={part.text}>
          {index > 0 && <span aria-hidden>·</span>}
          <span className={part.strong ? 'font-medium text-tx' : undefined}>{part.text}</span>
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
}

/** The breadcrumb, the sprint or flow heading and the metrics strip, as the Board mock's top. */
export function BoardHeader({ project, view, metrics, sprint, inFlight }: BoardHeaderProps) {
  const kanban = project.method === 'kanban';
  const flow = metrics ?? view.metrics;
  const committed = flow.committedPoints;
  const completed = flow.completedPoints;
  const line = sprint ? sprintLine(sprint, Date.now()) : null;
  const history = flow.throughputHistory.slice(-7);
  const peak = Math.max(1, ...history);
  const trend = flowTrend(flow.throughputHistory);
  const cycle = flow.cycleTimeDays;
  return (
    <>
      <Breadcrumbs
        items={[{ label: 'Projects' }, { label: project.name }, { label: view.board.name }]}
      />
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="m-0 text-22 font-semibold tracking-title whitespace-nowrap">
            {kanban ? `${project.name} board` : (sprint?.name ?? view.board.name)}
          </h1>
          {kanban ? (
            <Subtitle
              parts={[
                { text: 'Continuous flow' },
                { text: `${inFlight} in flight`, strong: true },
                cycle === null ? null : { text: `Avg cycle time ${cycle.toFixed(1)} days` },
                { text: `Throughput ${Math.round(flow.throughputPerWeek)} / week` },
              ]}
            />
          ) : line ? (
            <Subtitle
              parts={[
                line.dates ? { text: line.dates } : null,
                line.remaining ? { text: line.remaining, strong: true } : null,
                line.goal ? { text: line.goal } : null,
              ]}
            />
          ) : (
            <Subtitle
              parts={[{ text: 'No active sprint' }, { text: 'Start one from the Backlog' }]}
            />
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap">
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
            <MetricTile label="Velocity" value={`${completed}/${committed} pts`}>
              <ProgressBar
                size="md"
                value={committed > 0 ? (completed / committed) * 100 : 0}
                label="Sprint points done"
                className="w-20"
              />
            </MetricTile>
          )}
          {!kanban && sprint && (
            <Button onClick={() => navigateTo(`/work/backlog/${project.key}`)}>
              Complete sprint
            </Button>
          )}
          <BoardActionsMenu project={project} boardName={view.board.name} />
        </div>
      </div>
    </>
  );
}
