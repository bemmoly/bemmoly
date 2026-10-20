import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/index.ts';

/** /me carries capabilities; org admins hold "Delete workspace", which stands for all of them. */
const ORG_ADMIN_SIGNAL = 'workspace.delete';

export interface SettingsAccess {
  /** A workspace admin: the only person who changes the org defaults. */
  orgAdmin: boolean;
  /** Columns, lanes, filters, cards and the reset: "Configure board". */
  configureBoard: boolean;
  /** WIP limits alone: "Edit WIP limits", or "Configure board". */
  editWip: boolean;
  /** The project's method and its schemes: "Configure project". */
  configureProject: boolean;
  /** Initiatives and their epics: "Manage initiatives". */
  manageInitiatives: boolean;
}

/**
 * What the signed-in person may change on the settings pages, from their
 * workspace capabilities. A project role can grant more than these show; the
 * server decides on every save, and a refusal is shown where it happened.
 */
export function useSettingsAccess(): SettingsAccess {
  const me = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  const held = new Set(me.data?.capabilities ?? []);
  const orgAdmin = held.has(ORG_ADMIN_SIGNAL);
  const can = (capability: string) => orgAdmin || held.has(capability);
  const configureBoard = can('work.board.configure');
  return {
    orgAdmin,
    configureBoard,
    editWip: configureBoard || can('work.board.wip'),
    configureProject: can('work.project.configure'),
    manageInitiatives: can('work.initiative.manage'),
  };
}

/**
 * What may change on an org default page: everything for a workspace admin, nothing for anyone
 * else. The method is each project's own, so it never changes from here.
 */
export function orgDefaultsAccess(access: SettingsAccess): SettingsAccess {
  return {
    orgAdmin: access.orgAdmin,
    configureBoard: access.orgAdmin,
    editWip: access.orgAdmin,
    configureProject: false,
    manageInitiatives: access.manageInitiatives,
  };
}

export const NO_ORG_PERMISSION = 'Only workspace admins can change the org defaults.';
export const NO_BOARD_PERMISSION = 'You need "Configure board" to change this.';
export const NO_PROJECT_PERMISSION = 'You need "Configure project" to change this.';
