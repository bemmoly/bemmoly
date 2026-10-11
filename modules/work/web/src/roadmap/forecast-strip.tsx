import type { RoadmapItem } from '@bemmoly/module-work/shared';
import { Button, dayOfIso, IconButton, shortDate, yearOfDay } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';

/*
 * One neutral line under the filter row when something will slip: the item that slips most,
 * in words, what waits on it, and the way to its forecast. Nothing at risk, no strip. Dismiss
 * hides it for this item and state until the page reloads. It is arithmetic, not AI: amber
 * for the warning, never lilac.
 */

const dismissed = new Set<string>();

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** The late item with the most days late, else the at-risk one that lands first. */
export function slipping(items: readonly RoadmapItem[]): RoadmapItem | null {
  const late = items
    .filter((item) => item.forecast.state === 'late')
    .sort((a, b) => (b.forecast.daysLate ?? 0) - (a.forecast.daysLate ?? 0));
  if (late[0]) return late[0];
  const risky = items
    .filter((item) => item.forecast.state === 'at_risk')
    .sort((a, b) => (a.forecast.likely ?? '').localeCompare(b.forecast.likely ?? ''));
  return risky[0] ?? null;
}

export function stripWords(
  item: RoadmapItem,
  waiting: number,
  others: number,
  today: number,
): string {
  const year = yearOfDay(today);
  const when = (iso: string | null) => (iso ? shortDate(dayOfIso(iso), year) : '');
  const target = when(item.endAt ?? item.end);
  const first =
    item.forecast.state === 'late'
      ? `${item.title} is likely ${days(item.forecast.daysLate ?? 0)} past its ${target} target.`
      : `${item.title} may miss its ${target} target: likely ${when(item.forecast.likely)}, ${when(item.forecast.latest)} in the slower runs.`;
  const waits =
    waiting > 0 ? ` ${waiting} ${waiting === 1 ? 'item waits' : 'items wait'} on it.` : '';
  const more = others > 0 ? ` ${others} more ${others === 1 ? 'is' : 'are'} at risk or late.` : '';
  return `${first}${waits}${more}`;
}

export interface ForecastStripProps {
  items: readonly RoadmapItem[];
  dependencies: readonly { fromId: string; toId: string }[];
  today: number;
  onOpen: (item: RoadmapItem) => void;
}

export function ForecastStrip({ items, dependencies, today, onOpen }: ForecastStripProps) {
  const [, setHidden] = useState(0);
  const item = slipping(items);
  if (!item) return null;
  const key = `${item.id}:${item.forecast.state}:${item.forecast.daysLate ?? ''}`;
  if (dismissed.has(key)) return null;
  const waiting = dependencies.filter((dependency) => dependency.fromId === item.id).length;
  const others =
    items.filter((entry) => entry.forecast.state === 'late' || entry.forecast.state === 'at_risk')
      .length - 1;
  return (
    <div
      role="status"
      className="mx-6 mt-3 flex shrink-0 items-center gap-3 rounded-card border border-line bg-card py-2 pr-2 pl-3 text-13 max-md:mx-4 max-md:flex-wrap"
    >
      <Icon name="warning" size={16} className="shrink-0 text-amber" />
      <span className="shrink-0 font-semibold text-tx">Forecast</span>
      <span className="min-w-0 flex-1 text-tx-2 max-md:basis-full max-md:order-last">
        {stripWords(item, waiting, Math.max(0, others), today)}
      </span>
      <Button size="sm" onClick={() => onOpen(item)}>
        View forecast
      </Button>
      <IconButton
        label="Dismiss the forecast note"
        icon="close"
        size="sm"
        onClick={() => {
          dismissed.add(key);
          setHidden((count) => count + 1);
        }}
      />
    </div>
  );
}
