import type { StackPerson } from '@bemmoly/ui';
import { avatarHue } from '@bemmoly/ui';
import { useEffect, useMemo } from 'react';
import type { CardVocabulary } from '../board/card-view.ts';
import { useBoardData, useBoardMatching } from './board-data.ts';
import {
  cardMatches,
  hasClientFilters,
  quickFiltersOf,
  serverQuery,
  useBoardFilterStore,
} from './board-filters.ts';
import type { LqlValueSources } from './board-lql.ts';
import { compileColorRules } from './board-color-rules.ts';
import { buildBoardModel } from './board-model.ts';

/*
 * The Board screen's state in one place: the data, the filters applied over it, the laid-out
 * model, and the names the cards, the filter menus and the LQL bar print. Components stay
 * presentational and read only this.
 */

const LANE_KINDS = {
  epic: 'Epic',
  assignee: 'Assignee',
  priority: 'Priority',
  type: 'Type',
  query: 'Query',
} as const;

export function useBoardScreen(projectKey: string | undefined) {
  const filters = useBoardFilterStore();
  const data = useBoardData(projectKey);
  const boardConfig = data.view?.board.config;
  const quickFilters = useMemo(() => quickFiltersOf(boardConfig), [boardConfig]);
  const q = serverQuery(filters, quickFilters);
  const { matching, error: filterError } = useBoardMatching(data.board?.id, q);
  const kanban = data.project?.method === 'kanban';
  const reset = filters.reset;

  useEffect(() => reset(), [data.board?.id, reset]);

  const model = useMemo(
    () => (data.view ? buildBoardModel(data.view, filters.grouping) : null),
    [data.view, filters.grouping],
  );

  const statuses = useMemo(
    () => new Map(data.workflow?.statuses.map((status) => [status.id, status])),
    [data.workflow],
  );
  const vocab = useMemo<CardVocabulary>(
    () => ({
      types: new Map(data.issueTypes.map((type) => [type.id, type])),
      people: new Map(data.people.map((person) => [person.id, person])),
      labels: new Map(
        data.labels.map((label) => [label.id, { name: label.name, color: label.color }]),
      ),
      meId: data.meId,
      fields: boardConfig?.cardFields ?? [],
      colorRule: boardConfig?.colorRule ?? 'none',
      kanban,
      doneColumns: new Set(
        (boardConfig?.columns ?? []).filter((column) => column.done).map((column) => column.id),
      ),
      ruleColor: compileColorRules(boardConfig?.colorRules ?? [], {
        meId: data.meId,
        statusName: (id) => statuses.get(id)?.name,
        statusCategory: (id) => statuses.get(id)?.category,
        typeName: (id) => data.issueTypes.find((type) => type.id === id)?.name,
        userName: (id) => data.people.find((person) => person.id === id)?.name,
        labelName: (id) => data.labels.find((label) => label.id === id)?.name,
        issueKey: (id) => data.view?.lanes.find((lane) => lane.id === id)?.issueKey ?? undefined,
      }),
    }),
    [
      data.issueTypes,
      data.people,
      data.labels,
      data.meId,
      data.view,
      statuses,
      boardConfig,
      kanban,
    ],
  );

  const { view, meId } = data;
  const { search, lql, quick, people: chosenPeople, epics, types, labels } = filters;
  const isDimmed = useMemo(() => {
    const client = { search, lql, quick, people: chosenPeople, epics, types, labels };
    if (!matching && !hasClientFilters(client)) return undefined;
    const cards = new Map(view?.cards.map((card) => [card.issueId, card]));
    return (issueId: string) => {
      if (matching && !matching.has(issueId)) return true;
      const card = cards.get(issueId);
      return card ? !cardMatches(card, client, meId) : false;
    };
  }, [search, lql, quick, chosenPeople, epics, types, labels, matching, view, meId]);

  const people = useMemo<StackPerson[]>(() => {
    const onBoard = new Set(view?.cards.map((card) => card.assigneeId));
    return data.people
      .filter((person) => onBoard.has(person.id))
      .map((person) => ({
        id: person.id,
        name: person.name,
        hue: person.id === meId ? 'accent' : avatarHue(person.id),
      }));
  }, [data.people, view, meId]);

  const facets = useMemo(() => {
    const onBoard = <T>(ids: Iterable<T>) => new Set(ids);
    const typeIds = onBoard(view?.cards.map((card) => card.typeId) ?? []);
    const labelIds = onBoard(view?.cards.flatMap((card) => card.labelIds) ?? []);
    return {
      epics:
        boardConfig?.lanes.kind === 'epic'
          ? (view?.lanes ?? [])
              .filter((lane) => lane.issueKey)
              .map((lane) => ({ id: lane.id, label: lane.label }))
          : [],
      types: data.issueTypes
        .filter((type) => typeIds.has(type.id))
        .map((type) => ({ id: type.id, label: type.name })),
      labels: data.labels
        .filter((label) => labelIds.has(label.id))
        .map((label) => ({ id: label.id, label: label.name })),
    };
  }, [view, boardConfig, data.issueTypes, data.labels]);

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

  const laneKind = boardConfig?.lanes.kind ?? 'none';
  return {
    ...data,
    filterError,
    model,
    vocab,
    isDimmed,
    kanban,
    quickFilters,
    people,
    facets,
    lqlSources,
    serverQuery: q,
    laneLabel: laneKind === 'none' ? null : LANE_KINDS[laneKind],
  };
}
