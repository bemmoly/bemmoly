import type { AppearancePreference, CustomThemeRecord, SurfaceStyle } from '@bemmoly/shared';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import {
  customThemes,
  userAppearancePreferences,
  type CustomThemeRow,
} from '../../models/index.ts';

export function presentTheme(row: CustomThemeRow): CustomThemeRecord {
  return {
    id: row.id,
    name: row.name,
    brandColor: row.brandColor,
    surface: row.surface as SurfaceStyle,
    scope: row.ownerId ? 'personal' : 'workspace',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The workspace's custom themes, oldest first. */
export async function listWorkspaceThemes(db: Database): Promise<CustomThemeRecord[]> {
  const rows = await db
    .select()
    .from(customThemes)
    .where(isNull(customThemes.ownerId))
    .orderBy(asc(customThemes.id));
  return rows.map(presentTheme);
}

/**
 * A workspace custom theme. Themes are the workspace admin's choice (ADR 0021), so a personal
 * theme left from before is never found, edited or applied.
 */
export async function findWorkspaceTheme(
  db: Database,
  id: string,
): Promise<CustomThemeRow | undefined> {
  const [row] = await db
    .select()
    .from(customThemes)
    .where(and(eq(customThemes.id, id), isNull(customThemes.ownerId)));
  return row;
}

export async function readPreference(db: Database, userId: string): Promise<AppearancePreference> {
  const [row] = await db
    .select()
    .from(userAppearancePreferences)
    .where(eq(userAppearancePreferences.userId, userId));
  return {
    mode: (row?.mode as AppearancePreference['mode']) ?? null,
    // Only the mode is personal; a theme stored before ADR 0021's amendment is ignored.
    theme: null,
  };
}

export async function writePreference(
  db: Database,
  userId: string,
  value: AppearancePreference,
): Promise<void> {
  await db
    .insert(userAppearancePreferences)
    .values({ userId, mode: value.mode, theme: value.theme })
    .onConflictDoUpdate({
      target: userAppearancePreferences.userId,
      set: { mode: value.mode, theme: value.theme, updatedAt: new Date() },
    });
}
