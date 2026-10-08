import { createApiClient } from '@bemmoly/api-client';

/**
 * The module's API client. The shell's client is not shared through the chunk
 * props, and the two are identical: same origin, same session cookie; a 401
 * here surfaces as the query's error and the shell's own calls send the person
 * to sign in.
 */
export const api = createApiClient();

export type WorkApi = typeof api;

/** WebSocket URL for /ws on the same origin, as the shell computes it. */
export function realtimeUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}
