import type { RoadmapItem, RoadmapView } from '@bemmoly/module-work/shared';
import { dayOfIso, timelineScale } from '@bemmoly/ui';
import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { useIssuePeek } from '../shared/issue-peek.ts';
import type { RoadmapRowShared } from '../roadmap/roadmap-context.ts';
import { usePeople } from './issue-people.ts';
import { DOCKED_SLIDE_OVER_QUERY, useMediaQuery } from './media-query.ts';
import { placeBar, scrollToToday, type BarPlace } from './roadmap-bars.ts';
import { useRoadmapKeys } from './roadmap-keys.ts';
import { roadmapRows, roadmapSpan, rowTops, visibleItems } from './roadmap-model.ts';
import { useRoadmapSchedule } from './roadmap-schedule.ts';
import { useRoadmapView } from './roadmap-view.ts';

/*
 * Everything the Roadmap's body works with, once its view is in: the address state, the rows
 * and their axis, the bars (with any move in progress drawn in place), the peek and the
 * forecast panel, rescheduling and the screen's keys.
 */

const toggled = (set: ReadonlySet<string>, id: string) => {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

export function useRoadmapScreen(view: RoadmapView, oneProject: boolean) {
  const state = useRoadmapView(oneProject);
  const narrow = !useMediaQuery('(min-width: 768px)');
  const docked = useMediaQuery(DOCKED_SLIDE_OVER_QUERY);
  const { person } = usePeople();
  const [openItems, setOpenItems] = useState<ReadonlySet<string>>(new Set());
  const [closedGroups, setClosedGroups] = useState<ReadonlySet<string>>(new Set());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const instructionsId = useId();

  const today = dayOfIso(view.today);
  const items = useMemo(() => visibleItems(view, state), [view, state]);
  const rows = useMemo(
    () => roadmapRows(view, items, state.group, openItems, closedGroups),
    [view, items, state.group, openItems, closedGroups],
  );
  const { tops, height } = useMemo(() => rowTops(rows), [rows]);
  // The axis covers every item, filtered or not, so filtering never moves the dates.
  const span = useMemo(() => roadmapSpan(view.items, today), [view.items, today]);
  const scale = useMemo(
    () => timelineScale(state.zoom, span.from, span.to),
    [state.zoom, span.from, span.to],
  );
  const keyOf = useMemo(
    () => new Map(view.projects.map((project) => [project.id, project.key])),
    [view.projects],
  );
  const schedule = useRoadmapSchedule({
    today,
    dayWidth: scale.dayWidth,
    projectKeyOf: (projectId) => keyOf.get(projectId) ?? '',
  });
  const bars = useMemo(() => {
    const placed = new Map<string, BarPlace>();
    for (const item of items) {
      const place = placeBar(item, scale, today, schedule.drafts.get(item.id) ?? null);
      if (place) placed.set(item.id, place);
    }
    return placed;
  }, [items, scale, today, schedule.drafts]);

  const order = useMemo(
    () => rows.flatMap((row) => (row.kind === 'item' && row.item.key ? [row.item.key] : [])),
    [rows],
  );
  const peek = useIssuePeek(() => order);
  const openForecast = useCallback((item: RoadmapItem) => state.openForecast(item.id), [state]);
  const openIssue = useCallback(
    (key: string) => {
      state.openForecast(null);
      peek.open(key);
    },
    [state, peek],
  );
  const open = useCallback(
    (item: RoadmapItem) =>
      item.kind === 'epic' && item.key ? openIssue(item.key) : openForecast(item),
    [openIssue, openForecast],
  );
  const toggle = useCallback((id: string) => {
    if (/^(project|team):|^all$/.test(id)) setClosedGroups((set) => toggled(set, id));
    else setOpenItems((set) => toggled(set, id));
  }, []);
  const goToday = useCallback(
    () => scrollToToday(scrollerRef.current, scale, today, true),
    [scale, today],
  );
  useRoadmapKeys({
    today: goToday,
    zoom: state.setZoom,
    forecast: (id) => state.openForecast(id),
    searchRef,
    scrollerRef,
  });

  const shared: RoadmapRowShared = useMemo(
    () => ({
      scale,
      today,
      narrow,
      bars,
      schedule,
      open,
      openIssue,
      openForecast,
      toggle,
      personName: (id: string) => {
        const found = person(id);
        return found.id ? (found.name.split(' ')[0] ?? found.name) : null;
      },
      instructionsId,
    }),
    [
      scale,
      today,
      narrow,
      bars,
      schedule,
      open,
      openIssue,
      openForecast,
      toggle,
      person,
      instructionsId,
    ],
  );

  const epics = view.items.filter((item) => item.kind === 'epic').length;
  const versions = view.items.length - epics;
  const summary = [
    `${epics} ${epics === 1 ? 'epic' : 'epics'}`,
    versions > 0 ? `${versions} ${versions === 1 ? 'version' : 'versions'}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    state,
    items,
    rows,
    tops,
    height,
    shared,
    peek,
    docked,
    narrow,
    scrollerRef,
    searchRef,
    goToday,
    summary,
    axisKey: `${state.zoom}:${span.from}`,
    forecastItem: view.items.find((item) => item.id === state.forecast),
  };
}

export type RoadmapScreenState = ReturnType<typeof useRoadmapScreen>;
