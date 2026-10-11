import type {
  AppearancePreference,
  CreateCustomThemeInput,
  CustomThemeRecord,
  UpdateAppearancePreferenceInput,
  UpdateCustomThemeInput,
} from '@bemmoly/shared';
import { isThemeId } from '@bemmoly/ui/tokens';
import { audit, can, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { bodyOf, fail, ok, type MockRoute } from '../types.ts';

const MANAGE = 'workspace.appearance.manage';
const NO_PERSONAL = 'Your workspace does not let people pick their own theme.';

const personalAllowed = (db: MockDb) => db.settings['appearance.personalThemes'] === true;

type Stored = MockDb['customThemes'][number];

/** A stored theme as the API presents it: everything but its owner. */
function recordOf(theme: Stored): CustomThemeRecord {
  const { id, name, brandColor, surface, scope, createdAt, updatedAt } = theme;
  return { id, name, brandColor, surface, scope, createdAt, updatedAt };
}

/** Workspace themes and the signed-in person's own, as the server lists them. */
export function visibleThemes(db: MockDb): CustomThemeRecord[] {
  return db.customThemes
    .filter((theme) => theme.ownerId === null || theme.ownerId === db.signedInAs)
    .map(recordOf);
}

export function personalThemesOf(db: MockDb): CustomThemeRecord[] {
  return visibleThemes(db).filter((theme) => theme.scope === 'personal');
}

export function preferenceOf(db: MockDb): AppearancePreference {
  return db.appearancePreferences[db.signedInAs ?? ''] ?? { mode: null, theme: null };
}

function editable(db: MockDb, id: string) {
  const theme = db.customThemes.find((entry) => entry.id === id);
  if (!theme || (theme.ownerId !== null && theme.ownerId !== db.signedInAs)) return null;
  if (theme.ownerId === null && !can(db, MANAGE)) return 'forbidden' as const;
  if (theme.ownerId !== null && !personalAllowed(db)) return 'forbidden' as const;
  return theme;
}

/** /me/appearance and /themes, as the data kernel answers them (ADR 0021). */
export const appearanceRoutes: MockRoute[] = [
  { method: 'GET', pattern: '/api/v1/me/appearance', handle: (_, db) => ok(preferenceOf(db)) },
  {
    method: 'PUT',
    pattern: '/api/v1/me/appearance',
    handle: (request, db) => {
      const patch = bodyOf<UpdateAppearancePreferenceInput>(request);
      if (patch.theme) {
        if (!personalAllowed(db)) return fail(403, 'forbidden', NO_PERSONAL);
        const custom = patch.theme.startsWith('custom:');
        const known = custom
          ? visibleThemes(db).some((theme) => `custom:${theme.id}` === patch.theme)
          : isThemeId(patch.theme);
        if (!known) return fail(422, 'validation_failed', 'That theme does not exist.');
      }
      const next = { ...preferenceOf(db), ...patch };
      db.appearancePreferences[db.signedInAs ?? ''] = next;
      return ok(next);
    },
  },
  { method: 'GET', pattern: '/api/v1/themes', handle: (_, db) => ok({ items: visibleThemes(db) }) },
  {
    method: 'POST',
    pattern: '/api/v1/themes',
    handle: (request, db) => {
      const body = bodyOf<CreateCustomThemeInput>(request);
      if (body.scope === 'workspace' && !can(db, MANAGE))
        return fail(403, 'forbidden', 'Only people who can set appearance can add themes.');
      if (body.scope === 'personal' && !personalAllowed(db))
        return fail(403, 'forbidden', NO_PERSONAL);
      if (!body.name?.trim() || !body.brandColor || !body.surface || !body.scope)
        return fail(422, 'validation_failed', 'Give the theme a name, a colour and surfaces.');
      const now = new Date().toISOString();
      const theme = {
        id: newId(),
        name: body.name.trim(),
        brandColor: body.brandColor.toLowerCase(),
        surface: body.surface,
        scope: body.scope,
        createdAt: now,
        updatedAt: now,
        ownerId: body.scope === 'personal' ? db.signedInAs : null,
      };
      db.customThemes.push(theme);
      audit(db, 'custom_theme.created', 'custom_theme', theme.id);
      return ok(recordOf(theme), 201);
    },
  },
  {
    method: 'PATCH',
    pattern: '/api/v1/themes/:id',
    handle: (request, db) => {
      const theme = editable(db, request.params['id'] ?? '');
      if (!theme) return fail(404, 'not_found', 'That theme no longer exists.');
      if (theme === 'forbidden') return fail(403, 'forbidden', 'You cannot change this theme.');
      const body = bodyOf<UpdateCustomThemeInput>(request);
      Object.assign(theme, {
        ...body,
        ...(body.brandColor ? { brandColor: body.brandColor.toLowerCase() } : {}),
        updatedAt: new Date().toISOString(),
      });
      return ok(recordOf(theme));
    },
  },
  {
    method: 'DELETE',
    pattern: '/api/v1/themes/:id',
    handle: (request, db) => {
      const id = request.params['id'] ?? '';
      const theme = editable(db, id);
      if (!theme) return fail(404, 'not_found', 'That theme no longer exists.');
      if (theme === 'forbidden') return fail(403, 'forbidden', 'You cannot delete this theme.');
      if (
        db.settings['appearance.theme'] === 'custom' &&
        db.settings['appearance.customThemeId'] === id
      )
        return fail(
          409,
          'conflict',
          'This is the workspace default. Pick another default theme first.',
        );
      db.customThemes = db.customThemes.filter((entry) => entry.id !== id);
      audit(db, 'custom_theme.deleted', 'custom_theme', id);
      return ok();
    },
  },
];
