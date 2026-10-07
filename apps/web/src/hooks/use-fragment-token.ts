import { useEffect, useState } from 'react';

/**
 * Reads `token` from the URL fragment (#token=…) and then removes it from the
 * address bar, so it is not kept in history or copied along with the URL.
 */
export function useFragmentToken(): string | undefined {
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? undefined,
  );
  useEffect(() => {
    if (token && window.location.hash) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [token]);
  return token;
}
