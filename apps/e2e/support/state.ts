import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Scratch files of one run: the server's env and log, sessions and the seeded ids. */
export const STATE_DIR = fileURLToPath(new URL('../.state/', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export interface Person {
  id: string;
  name: string;
  email: string;
  password: string;
  /** Playwright storage state holding the person's session cookie. */
  storageState: string;
}

export interface RunState {
  baseURL: string;
  admin: Person;
  member: Person;
  /** A third person, who measures the board so the others' rate budget stays theirs. */
  observer: Person;
  /** The team the admin leads; the member is not in it. */
  team: { id: string; name: string };
  serverLog: string;
}

const STATE_FILE = `${STATE_DIR}run.json`;

export function statePath(name: string): string {
  mkdirSync(STATE_DIR, { recursive: true });
  return `${STATE_DIR}${name}`;
}

export function writeState(state: RunState): void {
  writeFileSync(statePath('run.json'), JSON.stringify(state, null, 2));
}

let cached: RunState | undefined;

/** Written by the global setup before any test starts. */
export function readState(): RunState {
  cached ??= JSON.parse(readFileSync(STATE_FILE, 'utf8')) as RunState;
  return cached;
}
