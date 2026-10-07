// Fixtures for bemmoly-raw-fetch-outside-clients. This file sits outside clients/, so every
// HTTP call here must match. Path exclusions (clients/, api-client) are covered by the rule.
declare const apiClient: { modules: { list(): Promise<unknown> } };
declare const undici: { request(url: string): Promise<unknown> };
declare const axios: { get(url: string): Promise<unknown> } & ((url: string) => Promise<unknown>);

export async function rawCalls(url: string) {
  // ruleid: bemmoly-raw-fetch-outside-clients
  await fetch(url);
  // ruleid: bemmoly-raw-fetch-outside-clients
  await globalThis.fetch(url, { method: 'POST' });
  // ruleid: bemmoly-raw-fetch-outside-clients
  await undici.request(url);
  // ruleid: bemmoly-raw-fetch-outside-clients
  await axios.get(url);
}

export async function throughClients() {
  // ok: bemmoly-raw-fetch-outside-clients
  await apiClient.modules.list();
  // ok: bemmoly-raw-fetch-outside-clients
  const prefetch = { fetchPriority: 'high' };
  return prefetch;
}
