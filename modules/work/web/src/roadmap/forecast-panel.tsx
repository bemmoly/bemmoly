import type { RoadmapItem, RoadmapView } from '@bemmoly/module-work/shared';
import {
  dayOfIso,
  Drawer,
  ForecastChip,
  MetricSparkline,
  SectionHeading,
  shortDate,
  yearOfDay,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { linkTo, workPaths } from '../hooks/issue-navigation.ts';

/*
 * An item's forecast in full, at ?forecast=ID: the likely day and the range, how sure it is,
 * the reasoning in plain words from the server, the pace it replayed, what is left, and what
 * it waits on and holds up. It is arithmetic, drawn in neutral and signal colours. The one
 * slot under the reasoning is for a commentary by AI; it renders only with AI on and only
 * when something fills it.
 */

export interface ForecastPanelProps {
  view: RoadmapView;
  item: RoadmapItem | undefined;
  onClose: () => void;
  onOpenForecast: (item: RoadmapItem) => void;
  variant: 'docked' | 'overlay';
  aiEnabled: boolean;
  /** A commentary by AI, drawn in its lilac surface; nothing fills it yet. */
  aiCommentary?: ReactNode;
}

const CONFIDENCE = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };

function Linked({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: readonly RoadmapItem[];
  onOpen: (item: RoadmapItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-1.5">
      <SectionHeading title={title} size="panel" />
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {items.map((entry) => (
          <li key={entry.id} className="flex items-center gap-2 text-13">
            <button
              type="button"
              onClick={() => onOpen(entry)}
              className="min-w-0 cursor-pointer truncate rounded-chip border-0 bg-transparent p-0 text-left font-sans text-13 text-tx hover:underline focus-ring"
            >
              {entry.title}
            </button>
            <ForecastChip state={entry.forecast.state} daysLate={entry.forecast.daysLate} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ForecastPanel({
  view,
  item,
  onClose,
  onOpenForecast,
  variant,
  aiEnabled,
  aiCommentary,
}: ForecastPanelProps) {
  const today = dayOfIso(view.today);
  const words = (iso: string | null) => (iso ? shortDate(dayOfIso(iso), yearOfDay(today)) : '');
  const history = item
    ? view.projects.find((project) => project.id === item.projectId)?.history
    : null;
  const peak = Math.max(1, ...(history?.samples ?? []));
  const byId = new Map(view.items.map((entry) => [entry.id, entry]));
  const waitsOn = item ? item.forecast.waitsOn.flatMap((id) => byId.get(id) ?? []) : [];
  const holdsUp = item
    ? view.dependencies.flatMap((dependency) =>
        dependency.fromId === item.id ? (byId.get(dependency.toId) ?? []) : [],
      )
    : [];
  const forecast = item?.forecast;
  return (
    <Drawer
      open={item !== undefined}
      onClose={onClose}
      label={item ? `${item.title} forecast` : 'Forecast'}
      variant={variant}
      header={
        item ? (
          <span className="flex min-w-0 items-center gap-2 text-13 font-semibold text-tx">
            <Icon
              name={item.kind === 'epic' ? 'roadmap' : 'releases'}
              size={14}
              className="text-tx-3"
            />
            <span className="truncate">{item.title}</span>
          </span>
        ) : null
      }
    >
      {item && forecast && (
        <>
          <section className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-20 font-semibold tracking-title text-tx tabular-nums">
                {forecast.likely ? `Likely ${words(forecast.likely)}` : 'No forecast date'}
              </h2>
              <ForecastChip state={forecast.state} daysLate={forecast.daysLate} />
            </div>
            <p className="m-0 text-12 text-tx-2 tabular-nums">
              {[
                forecast.earliest && forecast.latest
                  ? `${words(forecast.earliest)} to ${words(forecast.latest)}`
                  : null,
                forecast.confidence ? CONFIDENCE[forecast.confidence] : null,
                item.endAt ? `Target ${words(item.endAt)}` : 'No target date',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </section>
          <section className="flex flex-col gap-1.5">
            <SectionHeading title="How this was worked out" size="panel" />
            {forecast.explanation.map((sentence) => (
              <p key={sentence} className="m-0 text-14 leading-desc text-tx-2">
                {sentence}
              </p>
            ))}
          </section>
          {aiEnabled && aiCommentary}
          {history && (
            <section className="flex flex-col gap-1.5">
              <SectionHeading
                title="Pace"
                size="panel"
                hint={
                  history.basis === 'velocity'
                    ? `Points a sprint, last ${history.samples.length} sprints`
                    : `Issues a week, last ${history.samples.length} weeks`
                }
              />
              <MetricSparkline
                values={history.samples.map((value) => (value / peak) * 100)}
                recent={0}
                label={`${history.unit === 'points' ? 'Points' : 'Issues'} finished per ${history.basis === 'velocity' ? 'sprint' : 'week'}: ${history.samples.join(', ')}`}
              />
            </section>
          )}
          <p className="m-0 text-13 text-tx-2 tabular-nums">
            {item.progress.done} of {item.progress.total} issues done
            {forecast.remainingPoints !== null ? ` · ${forecast.remainingPoints} points left` : ''}
          </p>
          <Linked title="Waits on" items={waitsOn} onOpen={onOpenForecast} />
          <Linked title="Holds up" items={holdsUp} onOpen={onOpenForecast} />
          {item.key && (
            <a
              {...linkTo(workPaths.issue(item.key))}
              className="self-start rounded-chip text-13 text-acc hover:underline focus-ring"
            >
              Open {item.key}
            </a>
          )}
        </>
      )}
    </Drawer>
  );
}
