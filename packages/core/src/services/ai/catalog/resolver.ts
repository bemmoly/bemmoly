import type { AiCatalogSource, AiCatalogStatus, CatalogData } from '@bemmoly/shared';
import type { ModelsDevClient } from '../../../clients/models-dev.ts';
import type { Logger } from '../../../config/logger.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';
import { currentSnapshot, storeSnapshot, touchSnapshot } from '../store/snapshots.ts';
import { bundledCatalog, bundledLogos, safeSvg } from './bundled.ts';
import { catalogStatus } from './status.ts';
import { countModels, trimCatalog } from './trim.ts';

export interface CatalogResolverDeps {
  /** Without a database there are no stored snapshots: live, then bundled. */
  sql?: SqlExecutor;
  client: ModelsDevClient;
  /** The ai.liveCatalog setting; off means permanently offline. */
  liveEnabled: () => Promise<boolean>;
  appVersion: string;
  logger?: Pick<Logger, 'warn' | 'info'>;
  now?: () => Date;
  timeoutMs?: number;
  /** A live body this fresh is reused without a request. */
  reuseMs?: number;
}

export interface ResolvedCatalog {
  data: CatalogData;
  status: AiCatalogStatus;
}

interface Held {
  data: CatalogData;
  source: AiCatalogSource;
  fetchedAt: Date | null;
  etag: string | null;
  snapshotId: string | null;
  /** When models.dev last confirmed this copy, in this process. */
  liveAt: Date | null;
}

export interface CatalogResolver {
  /** Live first, then the last good snapshot, then the bundled copy. Never throws. */
  resolve(options?: { force?: boolean }): Promise<ResolvedCatalog>;
  /** Without a network request: what this process holds, the stored snapshot, or the bundle. */
  cached(): Promise<CatalogData>;
  upload(raw: unknown): Promise<ResolvedCatalog>;
  logo(providerId: string): Promise<string | null>;
}

export function createCatalogResolver(deps: CatalogResolverDeps): CatalogResolver {
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? 2_000;
  const reuseMs = deps.reuseMs ?? 60 * 60 * 1000;
  let held: Held | null = null;
  let inFlight: Promise<Held> | null = null;
  const logos = new Map<string, string | null>();

  async function stored(): Promise<Held> {
    const snapshot = deps.sql ? await currentSnapshot(deps.sql) : null;
    if (snapshot) {
      return {
        data: snapshot.data,
        source: snapshot.source,
        fetchedAt: new Date(snapshot.fetchedAt),
        etag: snapshot.etag,
        snapshotId: snapshot.id,
        liveAt: null,
      };
    }
    const data = await bundledCatalog();
    return { data, source: 'bundled', fetchedAt: null, etag: null, snapshotId: null, liveAt: null };
  }

  async function fetchLive(base: Held): Promise<Held> {
    const result = await deps.client.fetchCatalog({
      etag: base.source === 'live' ? base.etag : null,
      timeoutMs,
    });
    const at = now();
    if (result.status === 'not_modified') {
      if (deps.sql && base.snapshotId) await touchSnapshot(deps.sql, base.snapshotId);
      return { ...base, fetchedAt: at, liveAt: at };
    }
    const data = trimCatalog(result.body);
    if (deps.sql) {
      await storeSnapshot(deps.sql, {
        source: 'live',
        etag: result.etag,
        data,
        providerCount: Object.keys(data).length,
        modelCount: countModels(data),
      });
    }
    const snapshot = deps.sql ? await currentSnapshot(deps.sql) : null;
    return {
      data,
      source: 'live',
      fetchedAt: at,
      etag: result.etag,
      snapshotId: snapshot?.id ?? null,
      liveAt: at,
    };
  }

  const toResolved = (h: Held, liveFetch: boolean): ResolvedCatalog => ({
    data: h.data,
    status: catalogStatus({
      data: h.data,
      source: h.source,
      offline: h.liveAt === null,
      fetchedAt: h.fetchedAt,
      bundledWith: deps.appVersion,
      liveFetch,
      now: now(),
    }),
  });

  return {
    async resolve(options) {
      const live = await deps.liveEnabled();
      const base = held ?? (await stored());
      if (!live) {
        held = { ...base, liveAt: null };
        return toResolved(held, false);
      }
      const fresh = base.liveAt && now().getTime() - base.liveAt.getTime() < reuseMs;
      if (fresh && !options?.force) return toResolved(base, true);
      inFlight ??= fetchLive(base).finally(() => {
        inFlight = null;
      });
      try {
        held = await inFlight;
      } catch (error) {
        deps.logger?.warn(
          { err: error },
          'models.dev catalog unreachable; using the last good copy',
        );
        held = { ...(await stored()), liveAt: null };
      }
      return toResolved(held, true);
    },
    async cached() {
      held ??= await stored();
      return held.data;
    },
    async upload(raw) {
      const data = trimCatalog(raw);
      if (deps.sql) {
        await storeSnapshot(deps.sql, {
          source: 'uploaded',
          etag: null,
          data,
          providerCount: Object.keys(data).length,
          modelCount: countModels(data),
        });
      }
      const snapshot = deps.sql ? await currentSnapshot(deps.sql) : null;
      held = {
        data,
        source: 'uploaded',
        fetchedAt: now(),
        etag: null,
        snapshotId: snapshot?.id ?? null,
        liveAt: null,
      };
      return toResolved(held, await deps.liveEnabled());
    },
    async logo(providerId) {
      if (logos.has(providerId)) return logos.get(providerId) ?? null;
      let svg = safeSvg((await bundledLogos())[providerId]);
      if (!svg && (await deps.liveEnabled())) {
        try {
          svg = safeSvg(await deps.client.fetchLogo(providerId, { timeoutMs }));
        } catch {
          svg = null;
        }
      }
      logos.set(providerId, svg);
      return svg;
    },
  };
}
