import { useSyncExternalStore } from 'react';

/**
 * How someone last signed in on this device, so the sign-in page can put that way first: the
 * method, the provider, the email and the name. Browser storage only; nothing is sent to the
 * server, and "Not you?" forgets it. A shared computer can use a private window.
 */
export interface LastSignIn {
  method: 'password' | 'sso';
  providerId: string | null;
  email: string | null;
  name: string | null;
}

export const LAST_SIGN_IN_KEY = 'bemmoly.last-sign-in';

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: LastSignIn | null = null;

function parse(raw: string | null): LastSignIn | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LastSignIn>;
    if (value.method !== 'password' && value.method !== 'sso') return null;
    const text = (field: unknown) => (typeof field === 'string' && field ? field : null);
    return {
      method: value.method,
      providerId: text(value.providerId),
      email: text(value.email),
      name: text(value.name),
    };
  } catch {
    return null;
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(LAST_SIGN_IN_KEY);
  } catch {
    return null;
  }
}

/** The stored value; the same object until the storage changes, as useSyncExternalStore needs. */
export function readLastSignIn(): LastSignIn | null {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function notify() {
  for (const listener of listeners) listener();
}

export function rememberSignIn(value: LastSignIn): void {
  try {
    localStorage.setItem(LAST_SIGN_IN_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked (a private window): the page simply starts fresh next time.
  }
  notify();
}

/** Keeps the method and provider but adds who signed in, once the session names them. */
export function rememberPerson(person: { email: string; name: string }): void {
  const last = readLastSignIn();
  if (last) rememberSignIn({ ...last, email: person.email, name: person.name });
}

export function forgetSignIn(): void {
  try {
    localStorage.removeItem(LAST_SIGN_IN_KEY);
  } catch {
    // Nothing stored to forget.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAST_SIGN_IN_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useLastSignIn() {
  const last = useSyncExternalStore(subscribe, readLastSignIn, () => null);
  return { last, remember: rememberSignIn, forget: forgetSignIn };
}
