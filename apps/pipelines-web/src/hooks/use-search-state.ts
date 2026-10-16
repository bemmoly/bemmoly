import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

type Search = Record<string, unknown>;

/**
 * One value a screen keeps in the address (?range=30d), so a link opens the same view and
 * Back undoes a change of view. Values outside `allowed` read as the fallback, which is left
 * out of the address.
 */
export function useSearchState<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = (location.search as Search)[key];
  const value = allowed.includes(raw as T) ? (raw as T) : fallback;
  const set = useCallback(
    (next: T) =>
      void navigate({
        to: '.',
        replace: true,
        search: (previous: Search) => ({
          ...previous,
          [key]: next === fallback ? undefined : next,
        }),
      } as never),
    [navigate, key, fallback],
  );
  return [value, set];
}

/** A free-text value in the address (?q=, ?promotion=); empty is left out. */
export function useSearchText(key: string): [string, (value: string) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  const raw = (location.search as Search)[key];
  const value = typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : '';
  const set = useCallback(
    (next: string) =>
      void navigate({
        to: '.',
        replace: true,
        search: (previous: Search) => ({ ...previous, [key]: next || undefined }),
      } as never),
    [navigate, key],
  );
  return [value, set];
}
