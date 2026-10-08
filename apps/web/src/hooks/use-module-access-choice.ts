import type { ModuleAccessChoice, ModuleAccessMode, Team } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { teamsQuery } from './use-people.ts';

export interface AccessOption {
  mode: ModuleAccessMode;
  name: string;
  description: string;
  recommended?: boolean;
}

/** The choices in "Who can use <Module>?", least access first. */
export const ACCESS_OPTIONS: readonly AccessOption[] = [
  {
    mode: 'none',
    name: 'Nobody yet',
    description: 'Only org admins can open it until you grant access.',
    recommended: true,
  },
  {
    mode: 'everyone',
    name: 'Everyone',
    description: 'Every person in the workspace, including people who join later.',
  },
  {
    mode: 'teams',
    name: 'Specific teams',
    description: 'Only members of the teams you pick.',
  },
];

export const ACCESS_LATER =
  'You can change who has access at any time under Users › Module access.';

const SUGGESTED: Record<ModuleAccessMode, string> = {
  none: 'nobody until granted',
  everyone: 'everyone',
  teams: 'chosen teams',
};

/** The module author's defaultAccess, shown as a suggestion and never applied on its own. */
export function suggestionLine(name: string, suggested: ModuleAccessMode): string {
  return `${name} suggests access for ${SUGGESTED[suggested]}. Nothing is granted until you choose.`;
}

export function toAccessChoice(mode: ModuleAccessMode, teamIds: readonly string[]) {
  return (
    mode === 'teams' ? { mode, teamIds: [...teamIds] } : { mode }
  ) satisfies ModuleAccessChoice;
}

/** Specific teams needs at least one team; the other choices are always ready. */
export function canConfirmAccess(mode: ModuleAccessMode, teamIds: readonly string[]): boolean {
  return mode !== 'teams' || teamIds.length > 0;
}

/** Plain words for the toast after enabling. */
export function accessSummary(
  choice: ModuleAccessChoice,
  teams: readonly Pick<Team, 'id' | 'name'>[],
): string {
  if (choice.mode === 'none') return 'only org admins can open it for now';
  if (choice.mode === 'everyone') return 'everyone can open it';
  const names = (choice.teamIds ?? []).map(
    (id) => teams.find((team) => team.id === id)?.name ?? 'a team',
  );
  return `${names.join(', ')} can open it`;
}

/** The access draft inside the enable dialog: a mode and, for teams, the picked teams. */
export function useAccessChoice() {
  const teams = useQuery(teamsQuery).data?.items ?? [];
  const [mode, setMode] = useState<ModuleAccessMode>('none');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const picked = new Set(teamIds);
  return {
    teams,
    mode,
    setMode,
    teamIds,
    pickedTeams: teamIds.flatMap((id) => {
      const team = teams.find((entry) => entry.id === id);
      return team ? [{ id: team.id, name: team.name }] : [];
    }),
    teamOptions: teams
      .filter((team) => !picked.has(team.id))
      .map((team) => ({ value: team.id, label: team.name })),
    addTeam: (id: string) => id && setTeamIds((current) => [...new Set([...current, id])]),
    removeTeam: (id: string) => setTeamIds((current) => current.filter((entry) => entry !== id)),
    reset: () => {
      setMode('none');
      setTeamIds([]);
    },
    choice: toAccessChoice(mode, teamIds),
    ready: canConfirmAccess(mode, teamIds),
  };
}
