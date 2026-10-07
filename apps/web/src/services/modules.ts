import { apiErrorBodySchema, modulesResponseSchema, type ModuleManifest } from '@bemmoly/shared';

export class ApiRequestError extends Error {
  override readonly name = 'ApiRequestError';
  readonly status: number;
  readonly code: string;
  readonly requestId: string | undefined;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** The enabled modules for this person; the shell boots from this list. */
export async function fetchModules(fetchImpl: typeof fetch = fetch): Promise<ModuleManifest[]> {
  const response = await fetchImpl('/api/v1/modules', { headers: { accept: 'application/json' } });
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = apiErrorBodySchema.safeParse(body);
    if (error.success) {
      throw new ApiRequestError(
        response.status,
        error.data.code,
        error.data.message,
        error.data.requestId,
      );
    }
    throw new ApiRequestError(
      response.status,
      'internal_error',
      `Request failed with ${response.status}`,
    );
  }
  return modulesResponseSchema.parse(body).items;
}
