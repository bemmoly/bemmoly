import type { AppearancePreference, CustomThemeRecord, SurfaceStyle } from '@bemmoly/shared';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
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

/** One person's own custom themes, oldest first. */
export async function listPersonalThemes(
  db: Database,
  userId: string,
): Promise<CustomThemeRecord[]> {
  const rows = await db
    .select()
    .from(customThemes)
    .where(eq(customThemes.ownerId, userId))
    .orderBy(asc(customThemes.id));
  return rows.map(presentTheme);
}

/** A theme the person may see: a workspace one, or their own. */
export async function findVisibleTheme(
  db: Database,
  id: string,
  userId: string | null,
): Promise<CustomThemeRow | undefined> {
  const owner = userId
    ? or(isNull(customThemes.ownerId), eq(customThemes.ownerId, userId))
    : isNull(customThemes.ownerId);
  const [row] = await db
    .select()
    .from(customThemes)
    .where(and(eq(customThemes.id, id), owner));
  return row;
}

export async function readPreference(db: Database, userId: string): Promise<AppearancePreference> {
  const [row] = await db
    .select()
    .from(userAppearancePreferences)
    .where(eq(userAppearancePreferences.userId, userId));
  return {
    mode: (row?.mode as AppearancePreference['mode']) ?? null,
    theme: row?.theme ?? null,
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
