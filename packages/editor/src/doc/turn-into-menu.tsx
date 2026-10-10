import { Menu, MenuItem } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import type { ReactNode } from 'react';
import { keyLabel } from '../editor/tools.ts';
import { BLOCK_TYPES, currentBlockType, type BlockType } from './block-types.ts';

/** Gives the text back its focus once the menu has handed focus back to its trigger. */
export const refocus = (editor: Editor) =>
  requestAnimationFrame(() => {
    if (!editor.isDestroyed) editor.commands.focus();
  });

/** The block types as menu items, the current one ticked. */
export function TurnIntoItems({
  editor,
  onTurn,
}: {
  editor: Editor;
  /** Runs the turn; by default on the selection's own block. */
  onTurn?: (type: BlockType) => void;
}) {
  const current = currentBlockType(editor);
  return (
    <>
      {BLOCK_TYPES.map((type) => (
        <MenuItem
          key={type.id}
          icon={<Icon name={type.icon} size={15} className="text-tx-2" />}
          hint={type.keys ? keyLabel(type.keys) : undefined}
          checked={type.id === current.id ? true : undefined}
          onSelect={() => {
            if (onTurn) onTurn(type);
            else type.turn(editor.chain().focus()).run();
            refocus(editor);
          }}
        >
          {type.label}
        </MenuItem>
      ))}
    </>
  );
}

/** The bubble's first control: the block's type by name, opening Turn into. */
export function TurnIntoMenu({ editor, className }: { editor: Editor; className: string }) {
  const current = currentBlockType(editor);
  const label: ReactNode = (
    <>
      <Icon name={current.icon} size={15} />
      {current.label}
      <Icon name="caret" size={12} className="text-tx-3" />
    </>
  );
  return (
    <Menu
      widthClassName="w-60"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          aria-label={`Turn into, now ${current.label}`}
          className={`${className} font-medium text-tx`}
        >
          {label}
        </button>
      )}
    >
      <TurnIntoItems editor={editor} />
    </Menu>
  );
}
