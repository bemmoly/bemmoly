import { useSyncExternalStore } from 'react';

/*
 * Small preferences that belong to the signed-in person on this device: whether the sidebar
 * is folded, the last project, what they opened recently. The shell names the person once
 * after sign-in; every value is kept under that person's id, so two people sharing a browser
 * never see each other's recents. Storage can be missing or full (a private window): reads
 * then fall back to the default and writes stay in memory for the session.
 */

let person: string | null = null;
const memory = new Map<string, unknown>();
const listeners = new Set<() => void>();
let version = 0;

const storageKey = (key: string) => `bemmoly.${key}.${person ?? 'anyone'}`;

function emit() {
  version += 1;
  for (const listener of listeners) listener();
}

/** Called by the shell once the session is known; null signs the person out of the store. */
export function setPreferenceOwner(id: string | null): void {
  if (id === person) return;
  person = id;
  memory.clear();
  emit();
}

export function readPreference<T>(key: string, fallback: T): T {
  const full = storageKey(key);
  if (memory.has(full)) return memory.get(full) as T;
  let value = fallback;
  try {
    const raw = window.localStorage.getItem(full);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    value = fallback;
  }
  memory.set(full, value);
  return value;
}

export function writePreference<T>(key: string, value: T): void {
  const full = storageKey(key);
  memory.set(full, value);
  try {
    window.localStorage.setItem(full, JSON.stringify(value));
  } catch {
    // Kept in memory for this session; the next visit starts from the default.
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A preference as state: re-renders when it, or the person, changes. */
export function usePreference<T>(key: string, fallback: T): [T, (value: T) => void] {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return [readPreference(key, fallback), (value: T) => writePreference(key, value)];
}
