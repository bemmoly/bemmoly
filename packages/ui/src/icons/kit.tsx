import { KIT_MORE } from './kit-more.tsx';
import { KIT_SHELL } from './kit-shell.tsx';

/**
 * The design review's icon set (docs/design/premium/kit.js, `P`) under its names where they
 * read well, as Lucide icons. The last group is the palette a custom issue type picks from.
 */
export const KIT_ICONS = { ...KIT_SHELL, ...KIT_MORE };

export type KitIconName = keyof typeof KIT_ICONS;
