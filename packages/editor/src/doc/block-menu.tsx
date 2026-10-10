import { Menu, MenuGroup, MenuItem, MenuSeparator, Tooltip, useOptionalToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { ReactElement, ReactNode } from 'react';
import { headingIds } from '../convert/outline.ts';
import { keyLabel } from '../editor/tools.ts';
import type { RichTextDoc } from '../types.ts';
import { deleteBlock, duplicateBlock, type BlockRef } from './block-commands.ts';
import { refocus, TurnIntoItems } from './turn-into-menu.tsx';

/*
 * The block menu behind the grip: Turn into, Duplicate, Copy link to block (headings, which
 * carry the outline's anchors) and Delete, which happens at once with Undo in a toast.
 */

/** The anchor a heading block is reached by, as the outline and the read view number them. */
function headingAnchor(editor: Editor, block: BlockRef): string | null {
  if (block.node.type.name !== 'heading') return null;
  const ids = headingIds(editor.getJSON() as RichTextDoc);
  let index = -1;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') index += 1;
    if (pos === block.pos) found = index;
    return found < 0;
  });
  return found >= 0 ? (ids[found] ?? null) : null;
}

/** Puts the caret inside the block, so a turn applies to it. */
function caretInto(editor: Editor, block: BlockRef) {
  const { doc } = editor.state;
  editor.view.dispatch(
    editor.state.tr.setSelection(TextSelection.near(doc.resolve(block.pos + 1))),
  );
}

export function BlockMenu({
  editor,
  block,
  trigger,
}: {
  editor: Editor;
  block: BlockRef;
  trigger: (props: Record<string, unknown>) => ReactNode;
}) {
  const toast = useOptionalToast();
  const anchor = headingAnchor(editor, block);
  const textual = block.node.isTextblock || block.node.type.name.endsWith('Item');
  return (
    <Menu widthClassName="w-60" trigger={(props) => trigger({ ...props })}>
      {textual && (
        <MenuGroup label="Turn into">
          <TurnIntoItems
            editor={editor}
            onTurn={(type) => {
              caretInto(editor, block);
              type.turn(editor.chain().focus()).run();
            }}
          />
        </MenuGroup>
      )}
      {textual && <MenuSeparator />}
      <MenuItem
        icon={<Icon name="copy" size={15} className="text-tx-2" />}
        hint={keyLabel('Mod-d')}
        onSelect={() => {
          duplicateBlock(editor, block);
          refocus(editor);
        }}
      >
        Duplicate
      </MenuItem>
      {anchor && (
        <MenuItem
          icon={<Icon name="link" size={15} className="text-tx-2" />}
          onSelect={() => {
            const url = `${window.location.href.split('#')[0]}#${anchor}`;
            void navigator.clipboard?.writeText(url).then(
              () => toast?.show({ tone: 'ok', title: 'Link to this heading copied' }),
              () => toast?.show({ tone: 'danger', title: 'The link could not be copied' }),
            );
            refocus(editor);
          }}
        >
          Copy link to block
        </MenuItem>
      )}
      <MenuSeparator />
      <MenuItem
        tone="danger"
        icon={<Icon name="trash-can" size={15} />}
        hint={keyLabel('Backspace')}
        onSelect={() => {
          deleteBlock(editor, block);
          toast?.undo({ title: 'Block deleted', onUndo: () => editor.commands.undo() });
        }}
      >
        Delete
      </MenuItem>
    </Menu>
  );
}

/** The grip's tooltip, naming both of its jobs. */
export function GripTip({ children }: { children: ReactElement<Record<string, unknown>> }) {
  return (
    <Tooltip label="Drag to move, click for the block menu" keys="Alt+Shift+Up">
      {children}
    </Tooltip>
  );
}
