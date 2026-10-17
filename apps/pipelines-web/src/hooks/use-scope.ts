import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';

export interface ScopeParts {
  /** "commerce/checkout", or "" for the whole organisation. */
  path: string;
  domain: string | null;
  group: string | null;
}

export function parseScope(path: string | undefined): ScopeParts {
  const [domain, group] = (path ?? '').split('/').filter(Boolean);
  return {
    path: [domain, group].filter(Boolean).join('/'),
    domain: domain ?? null,
    group: domain && group ? group : null,
  };
}

/**
 * The scope every screen shows: Acme › Commerce › Checkout. It lives in the URL (?scope=),
 * so a link opens the same grain, and moving between screens keeps it.
 */
export function useScope() {
  const search = useSearch({ strict: false }) as { scope?: string };
  const navigate = useNavigate();
  const scope = parseScope(search.scope);
  const setScope = useCallback(
    (path: string) =>
      void navigate({
        to: '.',
        search: (previous: Record<string, unknown>) => ({ ...previous, scope: path || undefined }),
      }),
    [navigate],
  );
  return { ...scope, setScope };
}
