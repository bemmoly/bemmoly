import type { Issue } from '@bemmoly/module-work/shared';
import { createContext, useContext, type ReactNode } from 'react';

/*
 * What every backlog row shares and would otherwise thread through each container: the
 * blockers the backlog sent, and the row's ··· menu, which also opens on right-click.
 */

export interface BacklogRowShared {
  /** The keys of the open issues blocking each issue, by issue id. */
  blocked: Readonly<Record<string, readonly string[]>>;
  menu: (issue: Issue, containerId: string) => ReactNode;
}

const NONE: BacklogRowShared = { blocked: {}, menu: () => null };

export const BacklogRowContext = createContext<BacklogRowShared>(NONE);

export const useBacklogRowShared = () => useContext(BacklogRowContext);
