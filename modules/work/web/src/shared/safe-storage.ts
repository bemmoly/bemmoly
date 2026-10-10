import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/*
 * Browser storage for personal view preferences that never breaks the page: a private window,
 * blocked site data or a full quota make reads come back empty and writes do nothing, and the
 * screen carries on with its defaults for this visit.
 */

const quiet: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Blocked or full: the preference lasts until the page closes.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Nothing to remove from storage that cannot be reached.
    }
  },
};

export const safeJSONStorage = <S>() => createJSONStorage<S>(() => quiet);
