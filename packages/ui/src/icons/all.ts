import type { LucideIcon } from 'lucide-react';
import { EDITOR_ICONS } from './editor-icons.tsx';
import { GLYPHS, type IconName } from './icon.tsx';
import { KIT_ICONS } from './kit.tsx';
import { SHAPES } from './shapes.tsx';

/**
 * Every drawing at once, for code that renders icons ahead of time (the marketing site's build)
 * and cannot wait for the later icons. The app draws through `Icon`, never through this.
 */
export const ALL_ICONS: Readonly<Record<IconName, LucideIcon>> = {
  ...SHAPES,
  ...GLYPHS,
  ...KIT_ICONS,
  ...EDITOR_ICONS,
};
