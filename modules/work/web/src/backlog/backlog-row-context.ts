import type { Issue } from '@bemmoly/module-work/shared';
import { createContext, useContext, type ReactNode } from 'react';
import type { IssueQuickActions } from '../hooks/issue-quick-actions.ts';
import type { MenuSprint } from '../shared/issue-actions-menu.tsx';

/*
 * What every backlog row shares and would otherwise thread through each container: the
 * blockers the backlog sent, and the row's ··· menu, which also opens on right-click. Every row
 * reads this, so it holds only what changes rarely; what the menu needs, which a drop changes,
 * is in the menu's own context and reaches only the menus drawn so far.
 */

export interface BacklogRowShared {
  /** The keys of the open issues blocking each issue, by issue id. */
  blocked: Readonly<Record<string, readonly string[]>>;
  menu: (issue: Issue, containerId: string) => ReactNode;
  /** A touch screen has no hover: every row draws its menu from the start. */
  touch: boolean;
}

const NONE: BacklogRowShared = { blocked: {}, menu: () => null, touch: false };

export const BacklogRowContext = createContext<BacklogRowShared>(NONE);

export const useBacklogRowShared = () => useContext(BacklogRowContext);

/** What a row's menu acts with: the person, the quick edits, the sprints, the peek. */
export interface BacklogMenuShared {
  meId: string | undefined;
  quick: IssueQuickActions;
  sprints: readonly MenuSprint[];
  open(key: string): void;
  /** Issue keys by id, for a menu that acts on the whole selection. */
  keyOf: ReadonlyMap<string, string>;
}

export const BacklogMenuContext = createContext<BacklogMenuShared | null>(null);
