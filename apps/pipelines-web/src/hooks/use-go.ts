import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export interface Destination {
  /** Inside the app: "/releases/0199…/promote". */
  to: string;
  search?: Record<string, string | undefined>;
}

/**
 * Moves to a screen by path, keeping the scope. The route tree is built from lazily loaded
 * screens, so paths are plain strings here rather than the router's typed literals.
 */
export function useGo() {
  const navigate = useNavigate();
  return useCallback(
    ({ to, search = {} }: Destination) =>
      void navigate({
        to,
        search: (previous: Record<string, unknown>) => ({ scope: previous['scope'], ...search }),
      } as never),
    [navigate],
  );
}
