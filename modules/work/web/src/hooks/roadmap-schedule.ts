import type { RoadmapItem, RoadmapView } from '@bemmoly/module-work/shared';
import { isoOfDay, shortDate, useToast, yearOfDay, type TimelineGrip } from '@bemmoly/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { api, workKeys } from '../shared/index.ts';
import type { Dates } from './roadmap-bars.ts';

/*
 * Moving a bar. A pointer drag (or the arrow keys on a focused bar) moves a draft that the
 * bar draws at once; letting go, or half a second without another key, sends the change. The
 * new dates show on every cached roadmap in the same frame, the bar dims while the server
 * answers, a toast offers Undo for six seconds, and a refusal puts the bar back with Try
 * again. Epics move through the issue PATCH (their Target date field or due date), versions
 * through theirs.
 */

const KEY_REST_MS = 500;

/** Dates after moving a grip by some days; the start never passes the end. */
export function shiftDates(dates: Dates, grip: TimelineGrip, by: number): Dates {
  if (grip === 'move') return { start: dates.start + by, end: dates.end + by };
  if (grip === 'start') return { start: Math.min(dates.start + by, dates.end), end: dates.end };
  return { start: dates.start, end: Math.max(dates.end + by, dates.start) };
}

export const datesWords = (dates: Dates, today: number) =>
  `${shortDate(dates.start, yearOfDay(today))} – ${shortDate(dates.end, yearOfDay(today))}`;

/** The view with one item's stored and shown dates replaced. */
export function withDates(view: RoadmapView, id: string, dates: Dates): RoadmapView {
  const start = isoOfDay(dates.start);
  const end = isoOfDay(dates.end);
  return {
    ...view,
    items: view.items.map((item) =>
      item.id === id ? { ...item, startAt: start, endAt: end, start, end } : item,
    ),
  };
}

function send(item: RoadmapItem, projectKey: string, dates: Dates) {
  const startAt = isoOfDay(dates.start);
  const end = isoOfDay(dates.end);
  if (item.kind === 'version') {
    return api.work.versions.update(projectKey, item.id, { startAt, releaseAt: end });
  }
  return api.work.issues.update(item.key ?? '', {
    startAt,
    ...(item.targetField === 'dueAt' ? { dueAt: end } : { customFields: { target_date: end } }),
  });
}

interface Drag {
  id: string;
  grip: TimelineGrip;
  originX: number;
  base: Dates;
  moved: boolean;
}

export interface ScheduleOptions {
  today: number;
  dayWidth: number;
  projectKeyOf: (projectId: string) => string;
}

export function useRoadmapSchedule({ today, dayWidth, projectKeyOf }: ScheduleOptions) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [drafts, setDrafts] = useState<ReadonlyMap<string, Dates>>(new Map());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** A drag ends in a click on the same bar; that click must not open the item. */
  const justDragged = useRef(false);

  const setDraft = useCallback((id: string, dates: Dates | null) => {
    setDrafts((current) => {
      const next = new Map(current);
      if (dates) next.set(id, dates);
      else next.delete(id);
      return next;
    });
  }, []);

  const mark = useCallback((id: string, on: boolean) => {
    setPending((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const commit = useCallback(
    async (item: RoadmapItem, from: Dates, to: Dates, undoing = false) => {
      if (from.start === to.start && from.end === to.end) {
        setDraft(item.id, null);
        return;
      }
      const snapshot = queryClient.getQueriesData<RoadmapView>({ queryKey: workKeys.roadmaps() });
      queryClient.setQueriesData<RoadmapView>({ queryKey: workKeys.roadmaps() }, (view) =>
        view ? withDates(view, item.id, to) : view,
      );
      setDraft(item.id, null);
      mark(item.id, true);
      try {
        await send(item, projectKeyOf(item.projectId), to);
        if (!undoing) {
          toast.undo({
            title: `${item.title} moved to ${datesWords(to, today)}`,
            onUndo: () => void commit(item, to, from, true),
          });
        }
      } catch {
        for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
        toast.show({
          tone: 'danger',
          title: `Couldn't move ${item.title}`,
          body: 'Its dates are as they were. Check your connection and try again.',
          action: { label: 'Try again', onClick: () => void commit(item, from, to, undoing) },
        });
      } finally {
        mark(item.id, false);
        // The forecast moves with the dates; the server recomputes it.
        void queryClient.invalidateQueries({ queryKey: workKeys.roadmaps() });
        if (item.key) void queryClient.invalidateQueries({ queryKey: workKeys.issue(item.key) });
      }
    },
    [queryClient, toast, today, projectKeyOf, setDraft, mark],
  );

  /** Starts a pointer drag; touch reschedules in the peek instead, so it scrolls. */
  const grab = useCallback(
    (
      item: RoadmapItem,
      base: Dates,
      grip: TimelineGrip,
      event: PointerEvent<HTMLButtonElement>,
    ) => {
      if (!item.canSchedule || event.pointerType === 'touch') return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { id: item.id, grip, originX: event.clientX, base, moved: false };
      const move = (next: globalThis.PointerEvent) => {
        const current = drag.current;
        if (!current) return;
        const by = Math.round((next.clientX - current.originX) / dayWidth);
        if (by !== 0 && !current.moved) {
          current.moved = true;
          setDragging(item.id);
        }
        if (current.moved) setDraft(item.id, shiftDates(current.base, current.grip, by));
      };
      const finish = (end: globalThis.PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        window.removeEventListener('keydown', escape);
        const current = drag.current;
        drag.current = null;
        setDragging(null);
        if (!current?.moved) return;
        justDragged.current = true;
        if (end.type === 'pointercancel') return setDraft(item.id, null);
        const by = Math.round((end.clientX - current.originX) / dayWidth);
        void commit(item, current.base, shiftDates(current.base, current.grip, by));
      };
      const escape = (key: KeyboardEvent) => {
        if (key.key !== 'Escape' || !drag.current) return;
        key.preventDefault();
        drag.current.moved = false;
        setDraft(item.id, null);
        setDragging(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
      window.addEventListener('keydown', escape);
    },
    [dayWidth, commit, setDraft],
  );

  /** The arrow keys on a focused bar: the draft moves now, the change is sent once they rest. */
  const nudge = useCallback(
    (item: RoadmapItem, base: Dates, grip: TimelineGrip, by: number) => {
      if (!item.canSchedule) return;
      const from = drafts.get(item.id) ?? base;
      const to = shiftDates(from, grip, by);
      setDraft(item.id, to);
      const timer = timers.current.get(item.id);
      if (timer) clearTimeout(timer);
      timers.current.set(
        item.id,
        setTimeout(() => {
          timers.current.delete(item.id);
          void commit(item, base, to);
        }, KEY_REST_MS),
      );
    },
    [drafts, commit, setDraft],
  );

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const timer of pendingTimers.values()) clearTimeout(timer);
    };
  }, []);

  /** True once, after a drag, so the click that ends it does not open the item. */
  const consumeDrag = useCallback(() => {
    const was = justDragged.current;
    justDragged.current = false;
    return was;
  }, []);

  return { drafts, pending, dragging, grab, nudge, consumeDrag };
}

export type RoadmapSchedule = ReturnType<typeof useRoadmapSchedule>;
