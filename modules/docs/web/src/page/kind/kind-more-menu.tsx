import { IconButton, Menu, MenuItem, MenuSeparator } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useRef, useState } from 'react';
import { PAGE_FILE_ACCEPT } from '../../create/use-upload-page.ts';
import { MoveDialog } from '../header/move-dialog.tsx';
import { useCopyLink } from '../header/more-menu.tsx';
import { usePageScreen } from '../screen-context.ts';
import { useTrashPage } from '../use-page-actions.ts';
import { useReplaceFile, useTurnInto } from './use-kind-actions.ts';

/**
 * ··· on a file page or a folder: copy link, Replace file (a file page), Turn into a page,
 * move, and Move to trash with Undo. No history or export: there is no written body.
 */
export function KindMoreMenu() {
  const { page, readOnly } = usePageScreen();
  const copyLink = useCopyLink(page.id);
  const { trash } = useTrashPage(page);
  const { turnInto } = useTurnInto(page);
  const replace = useReplaceFile(page.id);
  const picker = useRef<HTMLInputElement>(null);
  const [moving, setMoving] = useState(false);
  const canChange = readOnly === null;

  return (
    <>
      <input
        ref={picker}
        type="file"
        accept={PAGE_FILE_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) replace.mutate(file);
        }}
      />
      <Menu
        align="end"
        trigger={(props) => (
          <IconButton {...props} label="More actions" icon="more" size="sm" variant="secondary" />
        )}
      >
        <MenuItem icon={<Icon name="link" size={14} />} onSelect={() => void copyLink()}>
          Copy link
        </MenuItem>
        {canChange && (
          <>
            {page.kind === 'file' && (
              <MenuItem
                icon={<Icon name="upload" size={14} />}
                disabled={replace.isPending}
                onSelect={() => picker.current?.click()}
              >
                Replace file…
              </MenuItem>
            )}
            <MenuItem icon={<Icon name="doc" size={14} />} onSelect={() => turnInto('page')}>
              Turn into a page
            </MenuItem>
            <MenuItem icon={<Icon name="arrow" size={14} />} onSelect={() => setMoving(true)}>
              Move to…
            </MenuItem>
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
