import { SidebarRow, useFrame, type ModuleSidebarProps } from '@bemmoly/core-web';
import { SpaceTile, spaceTone } from '@bemmoly/ui';
import { useSpaces } from './hooks/queries.ts';
import { docsPaths } from './shared/navigation.ts';

/** How many spaces the sidebar lists; Docs home lists them all. */
const SHOWN = 6;

/**
 * Docs' live sidebar rows: Docs home, then the person's spaces. A space's page tree stays
 * inside its pages for now, so the sidebar never holds two trees.
 */
export default function DocsSidebar(_props: ModuleSidebarProps) {
  const { mode, pathname } = useFrame();
  const spaces = useSpaces();
  const list = (spaces.data ?? []).slice(0, SHOWN);
  return (
    <>
      <SidebarRow label="Docs home" icon="doc" path={docsPaths.home()} exact />
      {list.map((space) => (
        <SidebarRow
          key={space.id}
          label={space.name}
          icon={
            <SpaceTile
              name={space.name}
              spaceKey={space.key}
              tone={spaceTone(space.key, space.color)}
              size="xs"
              className={mode === 'rail' ? '' : 'scale-90'}
            />
          }
          path={docsPaths.space(space.key)}
          active={pathname.startsWith(docsPaths.space(space.key))}
        />
      ))}
    </>
  );
}
