import type { BoardConfig } from '@bemmoly/module-work/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { workSettingsKeys } from '../api/index.ts';
import { columnProblems } from '../settings/model/columns.ts';
import { boardConfigDiff } from '../settings/model/diff.ts';
import { configLqlProblems } from '../settings/model/lql.ts';
import { columnsRisk, methodRisk, type ChangeConfirm } from '../settings/model/risks.ts';
import {
  BOARD_SECTIONS,
  discardSection,
  mergeSection,
  sectionDirty,
  type BoardDraft,
  type BoardSection,
} from '../settings/model/sections.ts';
import { api, workKeys } from '../shared/index.ts';
import { useBoardSettingsData } from './settings-board-data.ts';

/** What a section's save writes and what it asks first, worked out before anything is sent. */
export interface PreparedSave {
  section: BoardSection;
  config: BoardConfig;
  method: BoardDraft['method'];
  /** The rows of the review dialog. */
  changes: ReturnType<typeof boardConfigDiff>;
  /** Set when the change hides cards; ConfirmChange asks before the save. */
  risk: ChangeConfirm | null;
  /** Why it cannot be saved yet; the section shows these and Save stays shut. */
  problems: string[];
}

/**
 * Board settings: the stored board, one draft across the tabs and a save per
 * tab. A tab's save sends the stored config with only that tab's settings
 * from the draft, so another tab's unsaved edits are never sent with it.
 */
export function useBoardSettings(projectKey: string | undefined) {
  const data = useBoardSettingsData(projectKey);
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BoardDraft | null>(null);
  const { stored, board, project } = data;
  const value = draft ?? stored;

  const update = (change: (current: BoardDraft) => BoardDraft) =>
    setDraft((current) => {
      const base = current ?? stored;
      return base ? change(base) : current;
    });
  const updateConfig = (change: (config: BoardConfig) => BoardConfig) =>
    update((current) => ({ ...current, config: change(current.config) }));

  const dirty = Object.fromEntries(
    BOARD_SECTIONS.map((section) => [
      section,
      Boolean(stored && value && sectionDirty(section, stored, value)),
    ]),
  ) as Record<BoardSection, boolean>;

  const discard = (section: BoardSection) =>
    setDraft((current) => (current && stored ? discardSection(section, stored, current) : current));

  const prepare = (section: BoardSection): PreparedSave | null => {
    if (!stored || !value) return null;
    const config = mergeSection(section, stored.config, value.config);
    const method = section === 'method' ? value.method : stored.method;
    const problems = [
      ...(section === 'columns' ? columnProblems(config) : []),
      ...configLqlProblems(config, data.catalog).map((problem) => problem.message),
    ];
    const risk =
      section === 'columns'
        ? columnsRisk(stored.config, config, data.statuses, data.counts)
        : section === 'method'
          ? methodRisk(stored.method, method, config, data.counts)
          : null;
    const changes = boardConfigDiff(stored.config, config, data.statusName);
    if (method !== stored.method) {
      changes.unshift({
        key: 'method',
        label: 'Method',
        change: 'changed',
        before: stored.method === 'scrum' ? 'Scrum' : 'Kanban',
        after: method === 'scrum' ? 'Scrum' : 'Kanban',
        attributes: [],
      });
    }
    return { section, config, method, changes, risk, problems };
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: workKeys.all() });
  };

  const save = useMutation({
    mutationFn: async (prepared: PreparedSave) => {
      if (!board || !project || !stored) throw new Error('The board is not loaded yet');
      if (prepared.method !== stored.method) {
        await api.work.projects.update(project.id, { method: prepared.method });
      }
      const changedConfig = JSON.stringify(prepared.config) !== JSON.stringify(stored.config);
      return changedConfig ? api.work.boards.update(board.id, { config: prepared.config }) : board;
    },
    onSuccess: (saved, prepared) => {
      queryClient.setQueryData(workSettingsKeys.boards(saved.projectId ?? ''), (rows: unknown) =>
        Array.isArray(rows) ? rows.map((row) => (row.id === saved.id ? saved : row)) : rows,
      );
      setDraft((current) =>
        current
          ? discardSection(
              prepared.section,
              { config: saved.config, method: prepared.method },
              current,
            )
          : current,
      );
    },
    onSettled: refresh,
  });

  /** Puts the org default back: its columns matched to this project's statuses by name. */
  const reset = useMutation({
    mutationFn: async () => {
      if (!board || !data.orgConfig) throw new Error('The org default board is not loaded yet');
      return api.work.boards.update(board.id, { config: data.orgConfig });
    },
    onSuccess: () => setDraft(null),
    onSettled: refresh,
  });

  return { ...data, value, dirty, update, updateConfig, discard, prepare, save, reset };
}

export type BoardSettings = ReturnType<typeof useBoardSettings>;
