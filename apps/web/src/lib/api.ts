import { createApiClient, type ApiError } from '@bemmoly/api-client';
import { QueryClient } from '@tanstack/react-query';

type Listener = (error: ApiError) => void;
let onUnauthenticated: Listener | null = null;

/** The router registers how to react when a session expires mid-use. */
export function setUnauthenticatedHandler(listener: Listener | null): void {
  onUnauthenticated = listener;
}

/**
 * Whether this page has seen a signed-in session. A 401 means "your session ended" only then; a
 * visitor who never signed in is sent to plain sign-in by the route guard instead.
 */
let hadSession = false;

export function markSession(signedIn: boolean): void {
  hadSession = signedIn;
}

/** A 401 reaches the router's handler once, and only after a real session. */
export function reportUnauthenticated(error: ApiError): void {
  if (!hadSession) return;
  hadSession = false;
  onUnauthenticated?.(error);
}

/** The one API client for the web app; every request goes through it. */
export const api = createApiClient({ onUnauthenticated: reportUnauthenticated });

export type Api = typeof api;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          count < 1 &&
          !['unauthenticated', 'forbidden', 'not_found'].includes((error as ApiError).code),
      },
    },
  });
}

/** WebSocket URL for /ws on the same origin. */
export function realtimeUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}
