import type { Space } from '@bemmoly/module-docs/shared';
import { EntityTile, SPACE_TONE_HUES, spaceTone } from '@bemmoly/ui';

/**
 * A space's tile: one letter on its colour from the entity palette, never a signal colour, the
 * same in the sidebar, the header's trail and the space's own screens.
 */
export function SpaceTile({
  space,
  size,
}: {
  space: Pick<Space, 'key' | 'name' | 'color'>;
  size: number;
}) {
  const look = SPACE_TONE_HUES[spaceTone(space.key, space.color)];
  const tone = look === 'accent' || look === 'ink' ? { tone: look } : { hue: look };
  return <EntityTile name={space.name} size={size} {...tone} />;
}
