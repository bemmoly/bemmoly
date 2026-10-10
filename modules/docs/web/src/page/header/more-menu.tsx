import { useFrame, useScreenActions } from '@bemmoly/core-web';
import { IconButton, Menu, MenuItem, MenuSeparator, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useStarPage } from '../../hooks/mutations.ts';
import { docsPaths } from '../../shared/navigation.ts';
import { usePageChrome, usePageScreen, useSlotProps } from '../screen-context.ts';
import { HISTORY_SLOT, MENU_SLOTS } from '../slots.ts';
import { useDuplicatePage } from '../../create/use-duplicate-page.ts';
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
 * ···: copy link, duplicate, move, version history, the actions other folders add (Export),
 * and Move to trash with Undo.
 */
export function MoreMenu() {
  const screen = usePageScreen();
  const { page, readOnly } = screen;
  const slotProps = useSlotProps();
  const setMode = usePageChrome((state) => state.setMode);
  const copyLink = useCopyLink(page.id);
  const { trash } = useTrashPage(page);
  const [moving, setMoving] = useState(false);
  const copy = useDuplicatePage();
  const { phone } = useFrame();
  const star = useStarPage(page.id);
  const openMargin = usePageChrome((state) => state.openMargin);
  const trashed = readOnly === 'trashed';
  const canChange = !trashed && readOnly !== 'viewer';
  const name = page.title || 'Untitled';
  // ⌘K offers the page's own commands first, as Work's screens do.
  useScreenActions([
    {
      id: 'docs.copy-link',
      title: `Copy link to ${name}`,
      look: { kind: 'icon', icon: 'link' },
      run: () => void copyLink(),
    },
    ...(canChange
      ? [
          {
            id: 'docs.duplicate',
            title: `Duplicate ${name}`,
            look: { kind: 'icon' as const, icon: 'copy' },
            run: () => copy.duplicate(page.id),
          },
        ]
      : []),
    ...(!trashed
      ? [
          {
            id: 'docs.history',
            title: 'Open version history',
            keys: HISTORY_SLOT.keys,
            look: { kind: 'icon' as const, icon: HISTORY_SLOT.icon },
            run: () => setMode('history'),
          },
        ]
      : []),
  ]);

  return (
    <>
      <Menu
        align="end"
        trigger={(props) => (
          <IconButton {...props} label="More actions" icon="more" size="sm" variant="secondary" />
        )}
      >
        <MenuItem icon={<Icon name="link" size={14} />} onSelect={() => void copyLink()}>
          Copy link
        </MenuItem>
        {/* What the phone's one-bar header has no room for. */}
        {phone && !trashed && (
          <>
            <MenuItem
              icon={<Icon name="star" size={14} />}
              onSelect={() => star.mutate(!page.starred)}
            >
              {page.starred ? 'Remove from starred' : 'Star this page'}
            </MenuItem>
            <MenuItem icon={<Icon name="link" size={14} />} onSelect={() => openMargin('linked')}>
              Linked work
            </MenuItem>
          </>
        )}
        {canChange && (
          <>
            <MenuItem
              icon={<Icon name="copy" size={14} />}
              disabled={copy.isPending}
              onSelect={() => copy.duplicate(page.id)}
            >
              Duplicate
            </MenuItem>
            <MenuItem icon={<Icon name="arrow" size={14} />} onSelect={() => setMoving(true)}>
              Move to…
            </MenuItem>
          </>
        )}
        {!trashed && (
          <MenuItem
            icon={<Icon name={HISTORY_SLOT.icon} size={14} />}
            onSelect={() => setMode('history')}
          >
            {HISTORY_SLOT.label}
          </MenuItem>
        )}
        {MENU_SLOTS.map((Slot, index) => (
          <Slot key={index} {...slotProps} />
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
