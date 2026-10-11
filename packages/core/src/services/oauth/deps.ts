import type { Database } from '../../clients/drizzle.ts';
import type { FetchClientMetadata } from '../../clients/client-metadata.ts';
import type { ModuleCatalog } from '../authz/index.ts';

export interface OAuthDependencies {
  db: Database;
  /** BEMMOLY_PUBLIC_URL: the issuer, and the MCP addresses tokens are bound to. */
  publicUrl: string;
  modules: ModuleCatalog;
  isEnabled(moduleId: string): boolean;
  /** A module's display name, for the consent screen. */
  moduleName?(moduleId: string): string;
  /** Settings › MCP: whether clients may connect at all, and the modules it exposes. */
  settings(): Promise<{ enabled: boolean; modules: readonly string[] | null }>;
  /** Reads a client ID metadata document; checked against the address policy. */
  fetchClientMetadata: FetchClientMetadata;
  /** Injected so tests can move time; defaults to the wall clock. */
  now?: () => Date;
}

export const nowOf = (deps: Pick<OAuthDependencies, 'now'>): Date =>
  deps.now ? deps.now() : new Date();

/** Short-lived, so a leaked one is worth little; the refresh token renews it. */
export const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Rotated on every use; a connection unused for this long has to sign in again. */
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** The client exchanges the code straight after the redirect. */
export const AUTHORIZATION_CODE_TTL_MS = 2 * 60 * 1000;

export const ACCESS_TOKEN_PREFIX = 'bmo_at_';
export const REFRESH_TOKEN_PREFIX = 'bmo_rt_';

/** The modules exposed over MCP right now: enabled, and chosen in Settings › MCP. */
export async function exposedModules(deps: OAuthDependencies): Promise<string[]> {
  const settings = await deps.settings();
  return deps.modules
    .ids()
    .filter((id) => deps.isEnabled(id))
    .filter((id) => settings.modules === null || settings.modules.includes(id));
}

export function moduleNameOf(deps: OAuthDependencies, id: string): string {
  return deps.moduleName?.(id) ?? `${id.charAt(0).toUpperCase()}${id.slice(1)}`;
}
