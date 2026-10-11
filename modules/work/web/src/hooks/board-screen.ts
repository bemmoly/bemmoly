import type { CardField } from '@bemmoly/module-work/shared';
import { avatarHue, epicColor, statusStage, type EpicColor, type StatusStage } from '@bemmoly/ui';
import { useEffect, useMemo, useRef } from 'react';
import type { CardVocabulary } from '../board/card-view.ts';
import type { MenuSprint } from '../shared/issue-actions-menu.tsx';
import type { FilterOptions } from '../shared/issue-filter-bar.tsx';
import { useIssueFilters } from '../shared/issue-filters.ts';
import { setSearchParams, useSearchParam } from '../shared/url-state.ts';
import { useBoardData, useBoardMatching } from './board-data.ts';
import {
  cardMatches,
  hasClientFilters,
  quickFiltersOf,
  serverQuery,
  useBoardLanes,
} from './board-filters.ts';
import { useHiddenIssues } from './issue-quick-actions.ts';
import type { LqlValueSources } from './board-lql.ts';
import { compileColorRules } from './board-color-rules.ts';
import { useBoardDisplay } from './board-display.ts';
import {
  buildBoardModel,
  shareModel,
  type BoardGrouping,
  type BoardModel,
  type ViewCard,
} from './board-model.ts';

/*
 * The Board screen's state in one place: the data, the filters applied over it, the laid-out
 * model, and the names the cards, the filter menus and the LQL bar print. Components stay
 * presentational and read only this.
 */

const NO_FIELDS: readonly CardField[] = [];

const LANE_KINDS = {
  epic: 'Epic',
  assignee: 'Assignee',
  priority: 'Priority',
  type: 'Type',
  query: 'Query',
} as const;

export function useBoardScreen(projectKey: string | undefined) {
  const filterApi = useIssueFilters();
  const filters = filterApi.filters;
  const grouping: BoardGrouping = useSearchParam('group') === 'none' ? 'none' : 'lanes';
  const setGrouping = (value: BoardGrouping) =>
    setSearchParams({ group: value === 'none' ? 'none' : null });
  const data = useBoardData(projectKey);
  const boardConfig = data.view?.board.config;
  const quickFilters = useMemo(() => quickFiltersOf(boardConfig), [boardConfig]);
  const q = serverQuery(filters, quickFilters);
  const { matching, error: filterError } = useBoardMatching(data.board?.id, q);
  const kanban = data.project?.method === 'kanban';
  const resetLanes = useBoardLanes((state) => state.reset);
  const hidden = useHiddenIssues((state) => state.keys);

  useEffect(() => resetLanes(), [data.board?.id, resetLanes]);

  const { view, meId } = data;
  const display = useBoardDisplay(data.board?.id ?? '', meId, boardConfig?.cardFields ?? NO_FIELDS);
  const keep = useMemo(() => {
    if (!matching && !hasClientFilters(filters) && hidden.size === 0) return undefined;
    return (card: ViewCard) =>
      !hidden.has(card.key) &&
      (!matching || matching.has(card.issueId)) &&
      cardMatches(card, filters, meId);
  }, [filters, matching, meId, hidden]);

  // Laid out against the last model the screen showed, so the parts a change left alone keep
  // their identity and the cells and lanes holding them skip rendering.
  const shown = useRef<BoardModel | null>(null);
  const model = useMemo(
    () => (view ? shareModel(shown.current, buildBoardModel(view, grouping, keep)) : null),
    [view, grouping, keep],
  );
  useEffect(() => {
    shown.current = model;
  }, [model]);

  const statuses = useMemo(
    () => new Map(data.workflow?.statuses.map((status) => [status.id, status])),
    [data.workflow],
  );
  // The cards' names come from the lanes, not the cards: a drop replaces the view but keeps its
  // lanes, so the vocabulary, and every card that reads it, stays put.
  const viewLanes = view?.lanes;
  const vocab = useMemo<CardVocabulary>(
    () => ({
      types: new Map(data.issueTypes.map((type) => [type.id, type])),
      people: new Map(data.people.map((person) => [person.id, person])),
      labels: new Map(
        data.labels.map((label) => [label.id, { name: label.name, color: label.color }]),
      ),
      meId: data.meId,
      shown: display.shown,
      colorRule: boardConfig?.colorRule ?? 'none',
      kanban,
      doneColumns: new Set(
        (boardConfig?.columns ?? []).filter((column) => column.done).map((column) => column.id),
      ),
      epicColors: new Map(
        (viewLanes ?? []).flatMap((lane): [string, EpicColor][] =>
          lane.issueKey ? [[lane.id, epicColor(lane.color, lane.id)]] : [],
        ),
      ),
      ruleColor: compileColorRules(boardConfig?.colorRules ?? [], {
        meId: data.meId,
        statusName: (id) => statuses.get(id)?.name,
        statusCategory: (id) => statuses.get(id)?.category,
        typeName: (id) => data.issueTypes.find((type) => type.id === id)?.name,
        userName: (id) => data.people.find((person) => person.id === id)?.name,
        labelName: (id) => data.labels.find((label) => label.id === id)?.name,
        issueKey: (id) => viewLanes?.find((lane) => lane.id === id)?.issueKey ?? undefined,
      }),
    }),
    [
      data.issueTypes,
      data.people,
      data.labels,
      data.meId,
      viewLanes,
      statuses,
      boardConfig,
      kanban,
      display.shown,
    ],
  );

  const shownTotal = model ? model.lanes.reduce((sum, lane) => sum + lane.count, 0) : 0;

  const stages = useMemo(() => {
    const result: Record<string, StatusStage> = {};
    for (const column of boardConfig?.columns ?? []) {
      const first = column.statusIds.map((id) => statuses.get(id)).find(Boolean);
      result[column.id] = column.done
        ? 'done'
        : first
          ? statusStage(first.category, first.name)
          : 'todo';
    }
    return result;
  }, [boardConfig, statuses]);

  const filterOptions = useMemo<FilterOptions>(() => {
    const onBoard = <T>(ids: Iterable<T>) => new Set(ids);
    const typeIds = onBoard(view?.cards.map((card) => card.typeId) ?? []);
    const labelIds = onBoard(view?.cards.flatMap((card) => card.labelIds) ?? []);
    const assignees = onBoard(view?.cards.map((card) => card.assigneeId) ?? []);
    return {
      people: data.people
        .filter((person) => assignees.has(person.id))
        .map((person) => ({
          id: person.id,
          name: person.name,
          hue: person.id === meId ? ('accent' as const) : avatarHue(person.id),
        })),
      epics: (view?.lanes ?? [])
        .filter((lane) => lane.issueKey)
        .map((lane) => ({ id: lane.id, name: lane.label, color: epicColor(lane.color, lane.id) })),
      types: data.issueTypes
        .filter((type) => typeIds.has(type.id))
        .map((type) => ({ id: type.id, name: type.name, look: type })),
      labels: data.labels
        .filter((label) => labelIds.has(label.id))
        .map((label) => ({ id: label.id, name: label.name })),
      quick: quickFilters.map((chip) => ({ id: chip.id, name: chip.name })),
    };
  }, [view, data.issueTypes, data.labels, data.people, meId, quickFilters]);

  const lqlSources = useMemo<LqlValueSources>(
    () => ({
      users: data.people.map((person) => person.name),
      statuses: data.workflow?.statuses.map((status) => status.name) ?? [],
      issueTypes: data.issueTypes.map((type) => type.name),
      labels: data.labels.map((label) => label.name),
      epics: (view?.lanes ?? []).flatMap((lane) => (lane.issueKey ? [lane.issueKey] : [])),
      sprints: data.sprint ? [data.sprint.name] : [],
      projects: data.project ? [data.project.key] : [],
    }),
    [data.people, data.workflow, data.issueTypes, data.labels, view, data.sprint, data.project],
  );

  // A Scrum card can leave the running sprint, which holds every card on the board, for a
  // planned sprint or the Backlog.
  const moveTargets = useMemo<MenuSprint[] | undefined>(
    () =>
      kanban || !data.project
        ? undefined
        : [
            ...data.sprints.flatMap((sprint) =>
              sprint.state === 'closed' || sprint.id === view?.sprintId
                ? []
                : [{ id: sprint.id, name: sprint.name }],
            ),
            { id: null, name: 'Backlog' },
          ],
    [kanban, data.project, data.sprints, view?.sprintId],
  );

  const laneKind = boardConfig?.lanes.kind ?? 'none';
  return {
    ...data,
    filterError,
    model,
    vocab,
    kanban,
    defaultTypeId: (() => {
      const standard = data.issueTypes.filter((type) => type.level === 'standard');
      return (standard.find((type) => type.key === (kanban ? 'task' : 'story')) ?? standard[0])?.id;
    })(),
    quickFilters,
    filterOptions,
    filterApi,
    filtered: filterApi.filtered,
    shownTotal,
    stages,
    grouping,
    setGrouping,
    lqlSources,
    moveTargets,
    display,
    serverQuery: q,
    laneLabel: laneKind === 'none' ? null : LANE_KINDS[laneKind],
  };
}
