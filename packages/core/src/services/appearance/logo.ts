import type { Readable } from 'node:stream';
import {
  LOGO_EXTENSIONS,
  LOGO_PATH_PREFIX,
  NotFoundError,
  type LogoFileParams,
  type LogoType,
  type WorkspaceLogo,
} from '@bemmoly/shared';
import type { Database } from '../../clients/drizzle.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import type { ObjectStore } from '../../contracts/object-store.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { contentKey, putContent } from '../storage/index.ts';
import { checkLogo } from './logo-image.ts';
import { MANAGE_APPEARANCE } from './themes.ts';

/** Under the backed-up attachments folder, apart from page images. */
export const LOGO_PREFIX = 'attachments/brand';

export interface WorkspaceLogoDeps {
  db: Database;
  settings: SettingsService;
  store: ObjectStore;
  /** Where uploads are spooled while hashed (spoolDirectory(BEMMOLY_DATA_DIR)). */
  spoolDir: string;
}

export interface ServedLogo {
  mime: LogoType;
  size: number;
  /** The content hash: the logo's path never changes for the same bytes. */
  etag: string;
  body: Readable;
}

const TYPES = Object.fromEntries(
  Object.entries(LOGO_EXTENSIONS).map(([mime, ext]) => [ext, mime as LogoType]),
) as Record<string, LogoType>;

const WORKSPACE = { kind: 'workspace', id: null } as const;

async function audit(
  deps: WorkspaceLogoDeps,
  ctx: RequestContext,
  action: string,
  before: string,
  after: string,
) {
  await recordAudit(deps.db, {
    actor: ctx.actor,
    action,
    target: WORKSPACE,
    before: { logoKey: before || null },
    after: { logoKey: after || null },
    meta: ctx,
  });
}

/**
 * Checks and stores a new workspace logo, then points appearance.logoKey at the path it is
 * served from. The bytes go in before the setting names them, as every attachment does.
 */
export async function uploadWorkspaceLogo(
  deps: WorkspaceLogoDeps,
  ctx: RequestContext,
  bytes: Buffer,
): Promise<WorkspaceLogo> {
  await ctx.authz.authorize(ctx.actor, MANAGE_APPEARANCE, { kind: 'workspace' });
  const logo = checkLogo(bytes);
  const stored = await putContent(deps.store, logo.body, {
    contentType: logo.mime,
    prefix: LOGO_PREFIX,
    spoolDir: deps.spoolDir,
  });
  const logoKey = `${LOGO_PATH_PREFIX}${stored.checksumSha256}.${LOGO_EXTENSIONS[logo.mime]}`;
  const before = await deps.settings.get('appearance.logoKey');
  await deps.settings.set('appearance.logoKey', logoKey, ctx.actor);
  await audit(
    deps,
    ctx,
    before ? 'workspace.logo_replaced' : 'workspace.logo_added',
    before,
    logoKey,
  );
  return {
    logoKey,
    mime: logo.mime,
    size: logo.body.byteLength,
    width: logo.width,
    height: logo.height,
  };
}

/**
 * Clears the logo; the sidebar goes back to the Bemmoly lockup. The bytes stay in the store,
 * content addressed, so a backup taken before still restores what it names.
 */
export async function removeWorkspaceLogo(
  deps: WorkspaceLogoDeps,
  ctx: RequestContext,
): Promise<void> {
  await ctx.authz.authorize(ctx.actor, MANAGE_APPEARANCE, { kind: 'workspace' });
  const before = await deps.settings.get('appearance.logoKey');
  if (!before) return;
  await deps.settings.set('appearance.logoKey', '', ctx.actor);
  await audit(deps, ctx, 'workspace.logo_removed', before, '');
}

/**
 * The current logo's bytes, for anyone: the sign-in page and emails show it before anyone is
 * signed in. Only the logo the workspace uses now is served; a replaced one is gone.
 */
export async function readWorkspaceLogo(
  deps: Pick<WorkspaceLogoDeps, 'settings' | 'store'>,
  params: LogoFileParams,
): Promise<ServedLogo> {
  const current = await deps.settings.get('appearance.logoKey');
  if (current !== `${LOGO_PATH_PREFIX}${params.file}`) {
    throw new NotFoundError('The logo was not found');
  }
  const [sha256, ext] = params.file.split('.') as [string, string];
  const object = await deps.store.get(contentKey(LOGO_PREFIX, sha256));
  return { mime: TYPES[ext]!, size: object.metadata.size, etag: sha256, body: object.body };
}
