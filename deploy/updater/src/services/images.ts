import type { UpdaterStatus } from '@bemmoly/shared';
import { cosignAvailable, cosignVerify } from '../clients/cosign.ts';
import type { UpdaterContext } from './context.ts';

export type Verification = 'verified' | 'unverified' | 'local';

/** The image for a version: always the official repository, never one the caller names. */
export function imageFor(ctx: UpdaterContext, version: string): string {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version))
    throw new Error(`${version} is not a release version`);
  return `${ctx.env.BEMMOLY_IMAGE}:${version}`;
}

/** Pulls the image, or with BEMMOLY_UPDATER_LOCAL_IMAGES requires it to be loaded already. */
export async function obtainImage(ctx: UpdaterContext, reference: string): Promise<void> {
  if (ctx.env.BEMMOLY_UPDATER_LOCAL_IMAGES) {
    if (!(await ctx.docker.imageInfo(reference))) {
      throw new Error(
        `${reference} is not loaded; load the release bundle first (docker load -i …)`,
      );
    }
    return;
  }
  await ctx.docker.pull(reference);
}

/**
 * cosign verifies the signature when the binary is present. An image that cannot be
 * verified (no cosign, a local image, or a failed check) is refused unless the admin set
 * BEMMOLY_ALLOW_UNSIGNED_UPDATES=true, and is then recorded as unverified.
 */
export async function verifyImage(ctx: UpdaterContext, reference: string): Promise<Verification> {
  const unverified = (reason: string): Verification => {
    if (!ctx.env.BEMMOLY_ALLOW_UNSIGNED_UPDATES) {
      throw new Error(
        `${reason}. Refusing to update; set BEMMOLY_ALLOW_UNSIGNED_UPDATES=true in /var/bemmoly/.env to accept unsigned images.`,
      );
    }
    ctx.log(`${reason}; continuing because BEMMOLY_ALLOW_UNSIGNED_UPDATES=true`);
    return ctx.env.BEMMOLY_UPDATER_LOCAL_IMAGES ? 'local' : 'unverified';
  };
  if (ctx.env.BEMMOLY_UPDATER_LOCAL_IMAGES)
    return unverified(`${reference} is a local image and has no registry signature`);
  if (!(await cosignAvailable(ctx.env.COSIGN_BINARY)))
    return unverified('cosign is not available to verify the signature');
  try {
    await cosignVerify(reference, {
      binary: ctx.env.COSIGN_BINARY,
      identityRegexp: ctx.env.COSIGN_IDENTITY_REGEXP,
      oidcIssuer: ctx.env.COSIGN_OIDC_ISSUER,
      ...(ctx.env.COSIGN_PUBLIC_KEY ? { publicKey: ctx.env.COSIGN_PUBLIC_KEY } : {}),
    });
    return 'verified';
  } catch (error) {
    return unverified(error instanceof Error ? error.message : String(error));
  }
}

const DAY_MS = 86_400_000;

/**
 * Removes app images older than the retention window, never the running version and
 * never the previous one while a rollback is still offered.
 */
export async function pruneImages(ctx: UpdaterContext, state: UpdaterStatus): Promise<string[]> {
  const cutoff = ctx.now().getTime() - ctx.env.RETENTION_DAYS * DAY_MS;
  const rollbackOpen = state.updatedAt !== null && new Date(state.updatedAt).getTime() > cutoff;
  const keep = new Set([state.current, rollbackOpen ? state.previous : null].filter(Boolean));
  const lastUsed = new Map<string, number>();
  for (const entry of state.history) {
    const at = new Date(entry.at).getTime();
    for (const version of [entry.from, entry.to])
      lastUsed.set(version, Math.max(lastUsed.get(version) ?? 0, at));
  }
  const removed: string[] = [];
  for (const image of await ctx.docker.listImages(ctx.env.BEMMOLY_IMAGE)) {
    for (const reference of image.RepoTags ?? []) {
      const version = reference.slice(reference.lastIndexOf(':') + 1);
      if (keep.has(version)) continue;
      const used = lastUsed.get(version) ?? image.Created * 1000;
      if (used > cutoff) continue;
      try {
        await ctx.docker.removeImage(reference);
        removed.push(reference);
      } catch (error) {
        ctx.log(`kept ${reference}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return removed;
}
