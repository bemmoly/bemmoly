import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type CreateCustomThemeInput,
  type CustomThemeRecord,
  type UpdateCustomThemeInput,
} from '@bemmoly/shared';
import { buildCustomTheme } from '@bemmoly/ui/custom-theme';
import { eq } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import type { SettingsService } from '../../contracts/settings.ts';
import { customThemes, type CustomThemeRow } from '../../models/index.ts';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { findWorkspaceTheme, listWorkspaceThemes, presentTheme } from './store.ts';

export const MANAGE_APPEARANCE = 'workspace.appearance.manage' as const;

export const ADMIN_SETS_THEME = 'Your workspace admin sets the theme';

export interface AppearanceDeps {
  db: Database;
  settings: SettingsService;
}

/** The person behind the request; an API token acts for its user. */
export function personOf(ctx: RequestContext): string | null {
  if (ctx.actor.kind === 'user') return ctx.actor.id;
  return ctx.actor.userId ?? null;
}

const target = (id: string) => ({ kind: 'custom_theme', id });

/** The same generator the picker previews with: refuse a theme that fails any check. */
function assertChecked(brandColor: string, surface: CustomThemeRecord['surface']) {
  const built = buildCustomTheme({ brand: brandColor, surface });
  if (!built.pass) throw new ValidationError('This colour cannot be made to pass contrast');
}

/** The workspace's custom themes; only a workspace admin sets the theme (ADR 0021). */
export async function listCustomThemes(
  deps: AppearanceDeps,
  _ctx: RequestContext,
): Promise<CustomThemeRecord[]> {
  return listWorkspaceThemes(deps.db);
}

export async function createCustomTheme(
  deps: AppearanceDeps,
  ctx: RequestContext,
  input: CreateCustomThemeInput,
): Promise<CustomThemeRecord> {
  if (input.scope === 'personal') throw new ForbiddenError(ADMIN_SETS_THEME);
  await ctx.authz.authorize(ctx.actor, MANAGE_APPEARANCE, { kind: 'workspace' });
  const person = personOf(ctx);
  const brandColor = input.brandColor.toLowerCase();
  assertChecked(brandColor, input.surface);
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customThemes)
      .values({
        name: input.name,
        brandColor,
        surface: input.surface,
        ownerId: null,
        createdBy: person,
      })
      .returning();
    const theme = presentTheme(row as CustomThemeRow);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'custom_theme.created',
      target: target(theme.id),
      after: theme,
      meta: ctx,
    });
    return theme;
  });
}

export async function updateCustomTheme(
  deps: AppearanceDeps,
  ctx: RequestContext,
  id: string,
  input: UpdateCustomThemeInput,
): Promise<CustomThemeRecord> {
  const row = await findWorkspaceTheme(deps.db, id);
  if (!row) throw new NotFoundError('Theme not found');
  await ctx.authz.authorize(ctx.actor, MANAGE_APPEARANCE, { kind: 'workspace' });
  const brandColor = (input.brandColor ?? row.brandColor).toLowerCase();
  const surface = input.surface ?? (row.surface as CustomThemeRecord['surface']);
  assertChecked(brandColor, surface);
  const theme = await deps.db.transaction(async (tx) => {
    const [updated] = await tx
      .update(customThemes)
      .set({ name: input.name ?? row.name, brandColor, surface, updatedAt: new Date() })
      .where(eq(customThemes.id, id))
      .returning();
    const after = presentTheme(updated as CustomThemeRow);
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'custom_theme.updated',
      target: target(id),
      before: presentTheme(row),
      after,
      meta: ctx,
    });
    return after;
  });
  // The previous minor and emails read the mirrored brand of the workspace default.
  if ((await deps.settings.get('appearance.customThemeId')) === id)
    await deps.settings.set('appearance.brandColor', brandColor, ctx.actor);
  return theme;
}

export async function deleteCustomTheme(
  deps: AppearanceDeps,
  ctx: RequestContext,
  id: string,
): Promise<void> {
  const row = await findWorkspaceTheme(deps.db, id);
  if (!row) throw new NotFoundError('Theme not found');
  await ctx.authz.authorize(ctx.actor, MANAGE_APPEARANCE, { kind: 'workspace' });
  const [theme, current] = await Promise.all([
    deps.settings.get('appearance.theme'),
    deps.settings.get('appearance.customThemeId'),
  ]);
  if (theme === 'custom' && current === id)
    throw new ConflictError('This is the workspace default. Pick another default theme first.');
  await deps.db.transaction(async (tx) => {
    await tx.delete(customThemes).where(eq(customThemes.id, id));
    await recordAudit(tx, {
      actor: ctx.actor,
      action: 'custom_theme.deleted',
      target: target(id),
      before: presentTheme(row),
      meta: ctx,
    });
  });
}
