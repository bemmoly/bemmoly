import {
  ForbiddenError,
  type AppearancePreference,
  type UpdateAppearancePreferenceInput,
} from '@bemmoly/shared';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { readPreference, writePreference } from './store.ts';
import { ADMIN_SETS_THEME, personOf, type AppearanceDeps } from './themes.ts';

function personOrThrow(ctx: RequestContext): string {
  const person = personOf(ctx);
  if (!person) throw new ForbiddenError('Only a person has appearance preferences');
  return person;
}

export async function getAppearancePreference(
  deps: AppearanceDeps,
  ctx: RequestContext,
): Promise<AppearancePreference> {
  const person = personOf(ctx);
  return person ? readPreference(deps.db, person) : { mode: null, theme: null };
}

/**
 * Only the mode is the person's own (ADR 0021): the theme is the workspace admin's, so a
 * personal theme is refused and never stored.
 */
export async function setAppearancePreference(
  deps: AppearanceDeps,
  ctx: RequestContext,
  patch: UpdateAppearancePreferenceInput,
): Promise<AppearancePreference> {
  const person = personOrThrow(ctx);
  if (patch.theme) throw new ForbiddenError(ADMIN_SETS_THEME);
  const before = await readPreference(deps.db, person);
  const mode = patch.mode === undefined ? before.mode : patch.mode;
  const next: AppearancePreference = { mode, theme: null };
  await writePreference(deps.db, person, next);
  await recordAudit(deps.db, {
    actor: ctx.actor,
    action: 'user.appearance.updated',
    target: { kind: 'user', id: person },
    before,
    after: next,
    meta: ctx,
  });
  return next;
}
