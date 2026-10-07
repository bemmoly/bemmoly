import { requestJson } from './http-json.ts';

const MANIFEST_MAX_BYTES = 2 * 1024 * 1024;

/** Fetches the release manifest as untrusted JSON; the update service validates and verifies it. */
export async function fetchReleaseManifest(url: string, timeoutMs = 15_000): Promise<unknown> {
  return requestJson({ url, timeoutMs, maxBytes: MANIFEST_MAX_BYTES });
}
