import { SidebarRow, useFrame, type ModuleSidebarProps } from '@bemmoly/core-web';
import { EntityTile, SPACE_TONE_HUES, spaceTone, type EntityTileProps } from '@bemmoly/ui';
import { useSpaces } from './hooks/queries.ts';
import { docsPaths } from './shared/navigation.ts';

/** How many spaces the sidebar lists; Docs home lists them all. */
const SHOWN = 6;

/** A space's tile in the sidebar: one letter on its colour, like a project's. */
function spaceTile(space: { key: string; color: string | null }): Partial<EntityTileProps> {
  const look = SPACE_TONE_HUES[spaceTone(space.key, space.color)];
  return look === 'accent' || look === 'ink' ? { tone: look } : { hue: look };
}

/**
 * Docs' live sidebar rows: Docs home, then the person's spaces. A space's page tree stays
 * inside its pages for now, so the sidebar never holds two trees.
 */
export default function DocsSidebar(_props: ModuleSidebarProps) {
  const { pathname } = useFrame();
  const spaces = useSpaces();
  const list = (spaces.data ?? []).slice(0, SHOWN);
  return (
    <>
      <SidebarRow label="Docs home" icon="doc" path={docsPaths.home()} exact />
      {list.map((space) => (
        <SidebarRow
          key={space.id}
          label={space.name}
          icon={<EntityTile name={space.name} size={18} {...spaceTile(space)} />}
          path={docsPaths.space(space.key)}
          active={pathname.startsWith(docsPaths.space(space.key))}
        />
      ))}
    </>
  );
}
