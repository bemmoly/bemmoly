import { IconButton, Menu, MenuItem, MenuSeparator, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { docsPaths } from '../../shared/navigation.ts';
import { usePageChrome, usePageScreen } from '../screen-context.ts';
import { MENU_SLOTS, PANEL_SLOTS } from '../slots.ts';
import { useTrashPage } from '../use-page-actions.ts';
import { MoveDialog } from './move-dialog.tsx';

/** The page's address on this workspace, for the clipboard. */
export function pageUrl(pageId: string): string {
  return new URL(docsPaths.page(pageId), window.location.origin).toString();
}

/** Copies the page's address; when the clipboard is refused, the toast carries it instead. */
export function useCopyLink(pageId: string) {
  const { show } = useToast();
  return async () => {
    const url = pageUrl(pageId);
    try {
      await navigator.clipboard.writeText(url);
      show({ tone: 'ok', title: 'Link copied' });
    } catch {
      show({ tone: 'warn', title: 'Copy the link from here', body: url });
    }
  };
}

/**
 * ···: copy link, move, the panels other folders add (History), their actions (Export), and
 * Move to trash with Undo. Duplicate is absent: the API has no copy of a page yet.
 */
export function MoreMenu() {
  const screen = usePageScreen();
  const { page, editable, readOnly } = screen;
  const openPanel = usePageChrome((state) => state.openPanel);
  const copyLink = useCopyLink(page.id);
  const { trash } = useTrashPage(page);
  const [moving, setMoving] = useState(false);
  const trashed = readOnly === 'trashed';
  const canChange = !trashed && readOnly !== 'viewer';

  return (
    <>
      <Menu
        align="end"
        trigger={(props) => <IconButton {...props} label="More actions" icon="more" size="sm" variant="secondary" />}
      >
        <MenuItem icon={<Icon name="external" size={14} />} onSelect={() => void copyLink()}>
          Copy link
        </MenuItem>
        {canChange && (
          <MenuItem icon={<Icon name="arrow" size={14} />} onSelect={() => setMoving(true)}>
            Move to…
          </MenuItem>
        )}
        {PANEL_SLOTS.filter((slot) => slot.menu).map((slot) => (
          <MenuItem
            key={slot.id}
            icon={slot.menu?.icon ? <Icon name={slot.menu.icon} size={14} /> : undefined}
            onSelect={() => openPanel(slot.id)}
          >
            {slot.menu?.label}
          </MenuItem>
        ))}
        {MENU_SLOTS.map((Slot, index) => (
          <Slot key={index} page={page} editable={editable} />
        ))}
        {canChange && (
          <>
            <MenuSeparator />
            <MenuItem
              tone="danger"
              icon={<Icon name="trash" size={14} />}
              disabled={trash.isPending}
              onSelect={() => trash.mutate()}
            >
              Move to trash
            </MenuItem>
          </>
        )}
      </Menu>
      <MoveDialog page={page} open={moving} onClose={() => setMoving(false)} />
    </>
  );
}
