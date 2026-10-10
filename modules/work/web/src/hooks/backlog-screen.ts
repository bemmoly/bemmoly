import type { Issue } from '@bemmoly/module-work/shared';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RowHandlers } from '../backlog/backlog-item.tsx';
import { issueMatches, type Container } from '../backlog/model.ts';
import type { DropTarget } from '../backlog/move.ts';
import { useWorkRealtime } from '../shared/index.ts';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { useIssuePeek } from '../shared/issue-peek.ts';
import { useHiddenIssues } from './issue-quick-actions.ts';
import { useBacklogData } from './backlog-data.ts';
import { usePointerDrag } from './backlog-drag.ts';
import { useKeyboardMove, useRowKeys } from './backlog-keyboard.ts';
import { useMoveIssues } from './backlog-move.ts';
import { pruneSelection } from './backlog-selection.ts';
import { screenOrder, type ContainerLayout } from './backlog-slots.ts';
import { useBacklogUi } from './backlog-store.ts';

export interface Section {
  container: Container;
  /** The rows the filters leave, in rank order. */
  visible: Issue[];
}

/**
 * Everything the Backlog screen wires together: the data, the filtered
 * sections and their layout, live updates, and one set of row handlers for
 * clicks, pointer drags and the keyboard, all dropping through the same
 * optimistic move.
 */
export function useBacklogScreen(pathKey: string | undefined) {
  const data = useBacklogData(pathKey);
  const projectKey = data.project?.key ?? '';
  useWorkRealtime(data.project?.id);

  const reset = useBacklogUi((state) => state.reset);
  useEffect(() => {
    if (projectKey) reset(projectKey);
  }, [projectKey, reset]);

  const { filters, filtered } = useIssueFilters();
  const collapsed = useBacklogUi((state) => state.collapsed);
  const hidden = useHiddenIssues((state) => state.keys);
  const blocked = data.backlog?.blocked;
  const meId = data.meId;
  const sections = useMemo<Section[]>(
    () =>
      data.containers.map((container) => ({
        container,
        visible: container.issues.filter(
          (issue) =>
            !hidden.has(issue.key) &&
            (!filtered || issueMatches(issue, filters, meId, Boolean(blocked?.[issue.id]))),
        ),
      })),
    [data.containers, filtered, filters, hidden, blocked, meId],
  );
  const layout = useMemo<ContainerLayout[]>(
    () =>
      sections.map(({ container, visible }) => ({
        id: container.id,
        visibleIds: visible.map((issue) => issue.id),
        open: !collapsed[container.id],
      })),
    [sections, collapsed],
  );
  const keys = useMemo(
    () => new Map(data.containers.flatMap((c) => c.issues.map((issue) => [issue.id, issue.key]))),
    [data.containers],
  );

  const current = useRef({ layout, keys });
  current.current = { layout, keys };
  const getLayout = useCallback(() => current.current.layout, []);

  useEffect(() => {
    const ui = useBacklogUi.getState();
    const onScreen = new Set(layout.flatMap((container) => container.visibleIds));
    const pruned = pruneSelection(ui.selection, onScreen);
    if (pruned !== ui.selection) ui.setSelection(pruned);
  }, [layout]);

  const { drop } = useMoveIssues(projectKey);
  const onDrop = useCallback(
    (ids: readonly string[], target: DropTarget) => {
      const container = current.current.layout.find((entry) => entry.id === target.containerId);
      drop(ids, target, container?.visibleIds ?? []);
    },
    [drop],
  );
  const peek = useIssuePeek(() =>
    screenOrder(current.current.layout).flatMap((id) => {
      const key = current.current.keys.get(id);
      return key ? [key] : [];
    }),
  );
  const openPeek = peek.open;
  /** Opens the issue in the peek beside the list, with its key in the address. */
  const onOpen = useCallback(
    (id: string) => {
      const key = current.current.keys.get(id);
      if (key) openPeek(key);
    },
    [openPeek],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, consumeClick } = usePointerDrag({
    scrollRef,
    previewRef,
    layout: getLayout,
    onDrop,
  });
  const onKeyDown = useRowKeys({ layout: getLayout, onDrop, onOpen });
  useKeyboardMove({ layout: getLayout, onDrop, onOpen });

  const handlers = useMemo<RowHandlers>(
    () => ({
      onClick: (event, id) => {
        if (consumeClick()) return;
        const toggle = event.metaKey || event.ctrlKey;
        const ui = useBacklogUi.getState();
        if (toggle || event.shiftKey) {
          ui.select(id, { shift: event.shiftKey, toggle }, screenOrder(getLayout()));
          return;
        }
        // A plain click opens the peek and moves the anchor, without starting a selection.
        ui.setSelection({ ...ui.selection, anchor: id });
        onOpen(id);
      },
      onCheck: (event, id) => {
        useBacklogUi
          .getState()
          .select(id, { shift: event.shiftKey, toggle: !event.shiftKey }, screenOrder(getLayout()));
      },
      onPointerDown,
      onKeyDown,
      onOpen,
    }),
    [consumeClick, getLayout, onPointerDown, onKeyDown, onOpen],
  );

  const anchor = useBacklogUi((state) => state.selection.anchor);
  const order = screenOrder(layout);
  const entryId = anchor && order.includes(anchor) ? anchor : (order[0] ?? null);

  return { ...data, sections, filtered, handlers, entryId, scrollRef, previewRef, peek };
}
