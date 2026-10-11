/**
 * The models.dev catalog over HTTP: the whole api.json with ETag revalidation, and provider
 * logos. Server-side only; the browser never contacts it. Every call has a hard timeout.
 */
export const MODELS_DEV_URL = 'https://models.dev';

const MAX_CATALOG_BYTES = 32 * 1024 * 1024;
const MAX_LOGO_BYTES = 256 * 1024;

export type CatalogFetch =
  { status: 'not_modified' } | { status: 'fresh'; etag: string | null; body: unknown };

export interface ModelsDevClient {
  fetchCatalog(options: { etag: string | null; timeoutMs: number }): Promise<CatalogFetch>;
  /** The SVG text, or null when models.dev has none for this id. */
  fetchLogo(providerId: string, options: { timeoutMs: number }): Promise<string | null>;
}

export class ModelsDevError extends Error {
  override readonly name = 'ModelsDevError';
}

async function readCapped(response: Response, max: number, url: string): Promise<string> {
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > max) throw new ModelsDevError(`${url} is larger than ${max} bytes`);
  const text = await response.text();
  if (text.length > max) throw new ModelsDevError(`${url} is larger than ${max} bytes`);
  return text;
}

export function createModelsDevClient(baseUrl: string = MODELS_DEV_URL): ModelsDevClient {
  return {
    async fetchCatalog({ etag, timeoutMs }) {
      const url = `${baseUrl}/api.json`;
      const response = await fetch(url, {
        headers: { accept: 'application/json', ...(etag ? { 'if-none-match': etag } : {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 304) return { status: 'not_modified' };
      if (!response.ok) throw new ModelsDevError(`${url} answered ${response.status}`);
      const text = await readCapped(response, MAX_CATALOG_BYTES, url);
      try {
        return { status: 'fresh', etag: response.headers.get('etag'), body: JSON.parse(text) };
      } catch (error) {
        throw new ModelsDevError(`${url} did not return JSON`, { cause: error });
      }
    },
    async fetchLogo(providerId, { timeoutMs }) {
      if (!/^[a-z0-9][a-z0-9._-]*$/i.test(providerId)) return null;
      const url = `${baseUrl}/logos/${providerId}.svg`;
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 404) return null;
      if (!response.ok) throw new ModelsDevError(`${url} answered ${response.status}`);
      const type = response.headers.get('content-type') ?? '';
      if (!type.includes('svg')) return null;
      return readCapped(response, MAX_LOGO_BYTES, url);
    },
  };
}
