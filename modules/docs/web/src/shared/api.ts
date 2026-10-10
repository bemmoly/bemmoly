import { createApiClient } from '@bemmoly/api-client';
import { docsHistoryEndpoints } from '../api/history.ts';
import { docsLibraryEndpoints } from '../api/library.ts';
import { docsPagesEndpoints } from '../api/pages.ts';
import { docsTransferEndpoints } from '../api/transfer.ts';
import { docsMembersEndpoints } from './members-api.ts';

/**
 * The module's API client: the shell's generic client plus the Docs endpoints,
 * which live in this package so @bemmoly/api-client stays generic (as Work's
 * do). Same origin, same session cookie as the shell's client.
 */
const client = createApiClient();

export const api = {
  ...client,
  docs: {
    ...docsPagesEndpoints(client.http),
    ...docsLibraryEndpoints(client.http),
    ...docsHistoryEndpoints(client.http),
    ...docsTransferEndpoints(client.http),
    ...docsMembersEndpoints(client.http),
  },
};

export type DocsApi = typeof api;

/** WebSocket URL for /ws on the same origin, as the shell computes it. */
export function realtimeUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`;
}
