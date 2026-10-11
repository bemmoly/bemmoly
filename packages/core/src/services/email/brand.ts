import { buildCustomTheme } from '@bemmoly/ui/custom-theme';
import { FONTS, themeSource } from '@bemmoly/ui/tokens';
import { z } from 'zod';
import type { SettingsService } from '../../contracts/settings.ts';
import { DEFAULT_BRAND, type EmailBrand } from './templates/index.ts';

/**
 * Appearance keys are owned by the appearance settings, not by email, so they
 * are read untyped and parsed here: a missing or malformed value falls back to
 * Bemmoly's light set instead of breaking every email.
 */
export const APPEARANCE_KEYS = {
  theme: 'appearance.theme',
  brandColor: 'appearance.brandColor',
  font: 'appearance.font',
  logoKey: 'appearance.logoKey',
} as const;

type UntypedGet = (key: string) => Promise<unknown>;

const themeIdSchema = z.string().min(1);
const hexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const fontSchema = z.enum(Object.keys(FONTS) as [keyof typeof FONTS, ...(keyof typeof FONTS)[]]);
const logoKeySchema = z.string().min(1).nullable();

async function read<T>(get: UntypedGet, key: string, schema: z.ZodType<T>): Promise<T | undefined> {
  try {
    const parsed = schema.safeParse(await get(key));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Turns the stored logo key into a URL a mail client can fetch; null shows the initial tile.
 * `workspaceUrl` is where people open Bemmoly (workspace.url), when it is set.
 */
export type LogoUrlResolver = (logoKey: string, workspaceUrl?: string) => string | null;

/**
 * An uploaded logo is stored as the path this install serves it from, so a mail client reaches
 * it under the workspace's URL; an absolute https key is used as it is. Anything else, or a
 * workspace without an https URL, draws the initial tile instead of a broken image.
 */
export function defaultLogoUrl(logoKey: string, workspaceUrl?: string): string | null {
  if (/^https:\/\//.test(logoKey)) return logoKey;
  if (!logoKey.startsWith('/') || logoKey.startsWith('//')) return null;
  if (!workspaceUrl || !/^https:\/\//.test(workspaceUrl)) return null;
  try {
    return new URL(logoKey.slice(1), workspaceUrl.endsWith('/') ? workspaceUrl : `${workspaceUrl}/`)
      .href;
  } catch {
    return null;
  }
}

export async function loadEmailBrand(
  settings: SettingsService,
  resolveLogoUrl: LogoUrlResolver = defaultLogoUrl,
): Promise<EmailBrand> {
  const get = settings.get.bind(settings) as unknown as UntypedGet;
  const [workspaceName, workspaceUrl, themeId, brandColor, font, logoKey] = await Promise.all([
    read(get, 'workspace.name', z.string().min(1)),
    read(get, 'workspace.url', z.string()),
    read(get, APPEARANCE_KEYS.theme, themeIdSchema),
    read(get, APPEARANCE_KEYS.brandColor, hexSchema),
    read(get, APPEARANCE_KEYS.font, fontSchema),
    read(get, APPEARANCE_KEYS.logoKey, logoKeySchema),
  ]);
  // A custom theme's brand is mirrored into appearance.brandColor; its light set is generated
  // and checked the same way the app does it.
  const colors =
    themeId === 'custom' && brandColor
      ? buildCustomTheme({ brand: brandColor, surface: 'neutral' }).light
      : themeSource(themeId ?? 'bemmoly').light;
  return {
    workspaceName: workspaceName ?? DEFAULT_BRAND.workspaceName,
    colors,
    logoUrl: logoKey ? resolveLogoUrl(logoKey, workspaceUrl) : null,
    fontStack: FONTS[font ?? 'plex'].stack,
  };
}
