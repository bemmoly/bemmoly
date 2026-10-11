import type { ModuleColor, ModuleManifest } from '@bemmoly/shared';
import { EntityTile, type EntityTone } from '@bemmoly/ui';
import { ICON_NAMES, type IconName } from '@bemmoly/ui/icons';

/** The logo's three colours are the three module tones; any other colour is an epic hue. */
const TONES: Partial<Record<ModuleColor, EntityTone>> = {
  'brand-1': 'work',
  'brand-2': 'docs',
  'brand-3': 'ai',
  accent: 'accent',
};

/** A stored icon name the set draws, or undefined; a name the set lacks never prints as text. */
export const knownIcon = (value: string | null | undefined): IconName | undefined =>
  value && (ICON_NAMES as readonly string[]).includes(value) ? (value as IconName) : undefined;

export const moduleName = (manifest: Pick<ModuleManifest, 'id' | 'name'>) =>
  manifest.name ?? manifest.id.charAt(0).toUpperCase() + manifest.id.slice(1);

/**
 * A module's tile from its manifest: its icon on its colour, at the logo's corner ratio. A
 * module from an older server, without either, gets its initial on a stable palette hue.
 */
export function ModuleTile({
  manifest,
  size = 14,
}: {
  manifest: Pick<ModuleManifest, 'id' | 'name' | 'icon' | 'color'>;
  size?: number;
}) {
  const name = moduleName(manifest);
  const icon = knownIcon(manifest.icon);
  const tone = manifest.color ? TONES[manifest.color] : undefined;
  const color = manifest.color && !tone ? `var(--${manifest.color})` : undefined;
  return (
    <EntityTile
      name={name}
      size={size}
      {...(icon ? { icon } : {})}
      {...(tone ? { tone } : {})}
      {...(color ? { color } : {})}
    />
  );
}
