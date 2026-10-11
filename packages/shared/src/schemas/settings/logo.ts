import { z } from 'zod';

/** What a workspace logo may be, as sniffed from its bytes. SVG is checked for anything active. */
export const LOGO_TYPES = ['image/png', 'image/svg+xml', 'image/webp'] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

/** File extensions the logo is served under, one per type. */
export const LOGO_EXTENSIONS: Record<LogoType, string> = {
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

/** The largest logo, 1 MiB: it is drawn at 20 to 64 px. */
export const LOGO_MAX_BYTES = 1024 * 1024;
/** The smallest side of a raster logo, so it stays sharp on a dense screen. */
export const LOGO_MIN_PX = 128;
/** Longest side over shortest: square or near-square, so it sits in the tile without cropping. */
export const LOGO_MAX_RATIO = 1.25;

/** Why a logo was refused, in the error's details.reason. */
export const LOGO_REJECTIONS = [
  'empty',
  'too_large',
  'unsupported_type',
  'unsafe_svg',
  'unreadable',
  'too_small',
  'not_square',
] as const;
export type LogoRejection = (typeof LOGO_REJECTIONS)[number];

/** The served path of a stored logo: content addressed, so it can be cached for good. */
export const LOGO_PATH_PREFIX = '/api/v1/workspace/logo/';
export const logoFileParamsSchema = z.object({
  file: z.string().regex(/^[0-9a-f]{64}\.(png|svg|webp)$/),
});
export type LogoFileParams = z.output<typeof logoFileParamsSchema>;

/** POST /api/v1/workspace/logo answers with the stored key, which is also its URL. */
export const workspaceLogoSchema = z.object({
  /**
   * What appearance.logoKey now holds: the same-origin path the logo is served at. The dev
   * mock answers with an inline image instead.
   */
  logoKey: z.string().regex(/^(\/api\/v1\/workspace\/logo\/|data:image\/)/),
  mime: z.enum(LOGO_TYPES),
  size: z.number().int().nonnegative(),
  /** Pixel size of a raster logo; null for SVG, which scales. */
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});
export type WorkspaceLogo = z.output<typeof workspaceLogoSchema>;
