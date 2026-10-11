import { FONTS, PRESET_IDS, PRESETS, themeById } from '@bemmoly/ui/tokens';
import { z } from 'zod';
import type { SettingsService } from '../../contracts/settings.ts';
import { DEFAULT_BRAND, type EmailBrand } from './templates/index.ts';

/**
 * Appearance keys are owned by the appearance settings, not by email, so they
 * are read untyped and parsed here: a missing or malformed value falls back to
 * the Classic preset instead of breaking every email.
 */
export const APPEARANCE_KEYS = {
  theme: 'appearance.theme',
  brandColor: 'appearance.brandColor',
  font: 'appearance.font',
  logoKey: 'appearance.logoKey',
} as const;

type UntypedGet = (key: string) => Promise<unknown>;

const themeIdSchema = z.union([z.enum(PRESET_IDS as [string, ...string[]]), z.literal('custom')]);
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

/** Turns the stored logo key into a URL a mail client can fetch; null shows the initial tile. */
export type LogoUrlResolver = (logoKey: string) => string | null;

export function defaultLogoUrl(logoKey: string): string | null {
  return /^https:\/\//.test(logoKey) ? logoKey : null;
}

export async function loadEmailBrand(
  settings: SettingsService,
  resolveLogoUrl: LogoUrlResolver = defaultLogoUrl,
): Promise<EmailBrand> {
  const get = settings.get.bind(settings) as unknown as UntypedGet;
  const [workspaceName, themeId, brandColor, font, logoKey] = await Promise.all([
    read(get, 'workspace.name', z.string().min(1)),
    read(get, APPEARANCE_KEYS.theme, themeIdSchema),
    read(get, APPEARANCE_KEYS.brandColor, hexSchema),
    read(get, APPEARANCE_KEYS.font, fontSchema),
    read(get, APPEARANCE_KEYS.logoKey, logoKeySchema),
  ]);
  const preset = PRESETS.find((candidate) => candidate.id === themeId);
  const accent =
    themeId === 'custom' && brandColor ? brandColor : themeById(preset?.id ?? 'light').colors.acc;
  return {
    workspaceName: workspaceName ?? DEFAULT_BRAND.workspaceName,
    accent,
    logoUrl: logoKey ? resolveLogoUrl(logoKey) : null,
    fontStack: FONTS[font ?? preset?.font ?? 'plex'].stack,
  };
}
