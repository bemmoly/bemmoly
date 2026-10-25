import { SidebarRow, useFrame } from '@bemmoly/core-web';
import type { Space } from '@bemmoly/module-docs/shared';
import { IconButton, Menu, MenuItem, MenuSeparator, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState, type KeyboardEvent } from 'react';
import { docsPaths } from '../shared/navigation.ts';
import { EditSpaceDialog, useCanEditSpace } from './edit-space-dialog.tsx';
import { SidebarTree } from './sidebar-tree.tsx';
import { SpaceTile } from './space-tile.tsx';
import { AddMenuItems, useAddActions } from '../create/add-menu-items.tsx';
import { useCreateFolder } from '../create/use-create-folder.ts';
import { useCreatePage } from '../create/use-create-page.ts';

export interface SidebarSpaceProps {
  space: Space;
  /** The space the address is in: its row opens to its page tree. */
  open: boolean;
  /** Its overview or trash is on show, so the space row itself is current. */
  here: boolean;
  activePageId: string | undefined;
  /** Gives the space the sidebar to itself (focus mode). */
  onFocus: () => void;
}

const TOOL =
  'opacity-0 group-hover/space:opacity-100 group-focus-within/space:opacity-100 has-[[aria-expanded=true]]:opacity-100 pointer-coarse:opacity-100';

/** A space's ··· menu: the same on hover, on focus and on a right-click of the row. */
export function SpaceMenu({ space, onFocus }: { space: Space; onFocus?: () => void }) {
  const add = useCreatePage();
  const addFolder = useCreateFolder();
  const { navigate } = useFrame();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Menu
        align="start"
        widthClassName="w-52"
        trigger={(props) => (
          <IconButton
            {...props}
            data-space-menu=""
            label={`Actions for ${space.name}`}
            icon="more"
            size="tool"
          />
        )}
      >
        <MenuItem
          icon={<Icon name="plus" />}
          hint="N"
          onSelect={() => add.create({ spaceId: space.id, parentId: null, placeName: space.name })}
        >
          New page
        </MenuItem>
        <MenuItem
          icon={<Icon name="folder" />}
          onSelect={() =>
            addFolder.create({ spaceId: space.id, parentId: null, placeName: space.name })
          }
        >
          New folder
        </MenuItem>
        {onFocus ? (
          <MenuItem icon={<Icon name="filter" />} hint="F" onSelect={onFocus}>
            Focus on this space
          </MenuItem>
        ) : null}
        <MenuItem
          icon={<Icon name="layers" />}
          onSelect={() => navigate(docsPaths.space(space.key))}
        >
          Space overview
        </MenuItem>
        <MenuItem
          icon={<Icon name="link" />}
          onSelect={() => {
            void navigator.clipboard?.writeText(
              new URL(docsPaths.space(space.key), window.location.origin).href,
            );
            show({ tone: 'ok', title: 'Link copied' });
          }}
        >
          Copy link
        </MenuItem>
        <MenuSeparator />
        <EditSpaceItem spaceKey={space.key} onSelect={() => setEditing(true)} />
        <MenuItem
          icon={<Icon name="trash" />}
          onSelect={() => navigate(docsPaths.trash(space.key))}
        >
          Trash
        </MenuItem>
      </Menu>
      <EditSpaceDialog space={space} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

/** Asks whether the person may edit the space only once its menu opens, not for every row. */
function EditSpaceItem({ spaceKey, onSelect }: { spaceKey: string; onSelect: () => void }) {
  if (!useCanEditSpace(spaceKey)) return null;
  return (
    <MenuItem icon={<Icon name="edit" />} onSelect={onSelect}>
      Edit space
    </MenuItem>
  );
}

/**
 * One space in the sidebar's Docs section (docs-kit.js, `docsSidebar`): its tile and name like a
 * project's row, + and ··· on hover and focus, and under the current space its page tree.
 * Double-click or F gives it the sidebar to itself; a right-click opens its menu.
 */
export function SidebarSpace({ space, open, here, activePageId, onFocus }: SidebarSpaceProps) {
  const { mode } = useFrame();
  const addAny = useAddActions();
  const rail = mode === 'rail';
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'f' || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!(event.target as HTMLElement).matches('a')) return;
    event.preventDefault();
    onFocus();
  };
  return (
    <div className="flex flex-col gap-0.5">
      <div
        className="group/space relative flex flex-col"
        onDoubleClick={rail ? undefined : onFocus}
        onKeyDown={rail ? undefined : onKeyDown}
        onContextMenu={(event) => {
          const trigger = event.currentTarget.querySelector<HTMLButtonElement>('[data-space-menu]');
          if (!trigger) return;
          event.preventDefault();
          trigger.click();
        }}
      >
        <SidebarRow
          label={space.name}
          icon={<SpaceTile space={space} size={rail ? 22 : 18} />}
          path={docsPaths.space(space.key)}
          active={here}
          end={
            rail ? null : (
              <>
                {open ? (
                  <Icon
                    name="caret"
                    size={14}
                    className="shrink-0 text-tx-3 group-focus-within/space:hidden group-hover/space:hidden"
                  />
                ) : null}
                <span
                  aria-hidden
                  className="hidden w-11 shrink-0 group-focus-within/space:block group-hover/space:block pointer-coarse:block"
                />
              </>
            )
          }
        />
        {rail ? null : (
          <span className={`absolute top-1 right-1 flex items-center gap-px ${TOOL}`}>
            <Menu
              align="start"
              widthClassName="w-44"
              trigger={(props) => (
                <IconButton {...props} label={`Add to ${space.name}`} icon="plus" size="tool" />
              )}
            >
              <AddMenuItems
                add={addAny}
                place={{ spaceId: space.id, parentId: null, placeName: space.name }}
              />
            </Menu>
            <SpaceMenu space={space} onFocus={onFocus} />
          </span>
        )}
      </div>
      {open && !rail ? (
        <SidebarTree space={space} activePageId={activePageId ?? null} indentStart={20} />
      ) : null}
    </div>
  );
}
