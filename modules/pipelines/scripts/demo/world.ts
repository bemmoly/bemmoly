import type { SqlClient } from '@bemmoly/core';
import type { Rng } from './rng.ts';

/*
 * What one seed run has built so far, passed from step to step so later steps (history,
 * live work) can refer to the people, teams, applications and environments by id.
 */

export interface SeedContext {
  sql: SqlClient;
  rng: Rng;
  now: Date;
  /** 1 is the full Acme; tests use a small fraction. */
  scale: number;
  log: (line: string) => void;
}

export interface Person {
  id: string;
  name: string;
}

export interface Team {
  id: string;
  name: string;
  members: string[];
}

export interface AppInfo {
  id: string;
  key: string;
  domainId: string;
  domainKey: string;
  groupId: string;
  groupKey: string;
  ownerTeam: Team | null;
  tier: number;
  ciMode: string;
  repoId: string;
  repoFullName: string;
  /** Busier applications run more often. */
  weight: number;
  version: { major: number; minor: number; patch: number };
  /** Applications the design shows at exact versions only bump patches in history. */
  steady: boolean;
}

export interface EnvInfo {
  id: string;
  key: string;
  name: string;
  class: 'dev' | 'staging' | 'prod';
  position: number;
}

export interface World extends SeedContext {
  demo: Person;
  people: Person[];
  teams: Map<string, Team>;
  domains: { id: string; key: string; name: string }[];
  groups: { id: string; key: string; domainId: string; domainKey: string }[];
  apps: AppInfo[];
  appsByKey: Map<string, AppInfo>;
  envs: EnvInfo[];
  envByKey: Map<string, EnvInfo>;
  pools: { id: string; key: string }[];
}

export function team(world: Pick<World, 'teams'>, name: string): Team {
  const found = world.teams.get(name);
  if (!found) throw new Error(`The seed has no team called ${name}`);
  return found;
}

export function app(world: Pick<World, 'appsByKey'>, key: string): AppInfo {
  const found = world.appsByKey.get(key);
  if (!found) throw new Error(`The seed has no application called ${key}`);
  return found;
}

export function env(world: Pick<World, 'envByKey'>, key: string): EnvInfo {
  const found = world.envByKey.get(key);
  if (!found) throw new Error(`The seed has no environment called ${key}`);
  return found;
}

export function nextVersion(info: AppInfo, rng: Rng): string {
  if (!info.steady && rng.chance(0.15)) {
    info.version.minor += 1;
    info.version.patch = 0;
  } else {
    info.version.patch += 1;
  }
  return `v${info.version.major}.${info.version.minor}.${info.version.patch}`;
}

/** Someone in the owning team other than the demo person, whose own work is drawn apart. */
export function colleague(world: Pick<World, 'demo'>, info: AppInfo): string | null {
  return info.ownerTeam?.members.find((id) => id !== world.demo.id) ?? null;
}
