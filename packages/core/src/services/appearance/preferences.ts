import {
  ForbiddenError,
  ValidationError,
  type AppearancePreference,
  type UpdateAppearancePreferenceInput,
} from '@bemmoly/shared';
import { isThemeId } from '@bemmoly/ui/tokens';
import { recordAudit } from '../audit/index.ts';
import type { RequestContext } from '../authz/index.ts';
import { findVisibleTheme, readPreference, writePreference } from './store.ts';
import { personOf, type AppearanceDeps } from './themes.ts';

const CUSTOM_PREFIX = 'custom:';

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
 * Mode is always the person's own. A theme of their own needs the workspace to allow it, and
 * a custom one must be a workspace theme or theirs.
 */
export async function setAppearancePreference(
  deps: AppearanceDeps,
  ctx: RequestContext,
  patch: UpdateAppearancePreferenceInput,
): Promise<AppearancePreference> {
  const person = personOrThrow(ctx);
  const before = await readPreference(deps.db, person);
  const next: AppearancePreference = { ...before, ...patch };
  if (patch.theme) {
    if (!(await deps.settings.get('appearance.personalThemes')))
      throw new ForbiddenError('Your workspace does not let people pick their own theme');
    if (patch.theme.startsWith(CUSTOM_PREFIX)) {
      const id = patch.theme.slice(CUSTOM_PREFIX.length);
      if (!(await findVisibleTheme(deps.db, id, person)))
        throw new ValidationError('That custom theme does not exist');
    } else if (!isThemeId(patch.theme)) {
      throw new ValidationError(`There is no theme called "${patch.theme}"`);
    }
  }
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
