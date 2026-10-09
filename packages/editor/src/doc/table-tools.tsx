import { Button } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import { useEditorState } from '../editor/use-editor.ts';

/*
 * The table's tools, over the table the caret is in: add and remove rows and columns, turn
 * the header row on or off, delete the table. A table has no tools in the mock, so they take
 * the menu's surface and the ghost buttons, and stay out of the way until a cell is focused.
 */

interface TableTool {
  label: string;
  run: (editor: Editor) => boolean;
  can: (editor: Editor) => boolean;
  danger?: boolean;
}

const chain = (editor: Editor) => editor.chain().focus();

const TOOLS: readonly TableTool[] = [
  {
    label: 'Row above',
    run: (e) => chain(e).addRowBefore().run(),
    can: (e) => e.can().addRowBefore(),
  },
  {
    label: 'Row below',
    run: (e) => chain(e).addRowAfter().run(),
    can: (e) => e.can().addRowAfter(),
  },
  {
    label: 'Column left',
    run: (e) => chain(e).addColumnBefore().run(),
    can: (e) => e.can().addColumnBefore(),
  },
  {
    label: 'Column right',
    run: (e) => chain(e).addColumnAfter().run(),
    can: (e) => e.can().addColumnAfter(),
  },
  {
    label: 'Header row',
    run: (e) => chain(e).toggleHeaderRow().run(),
    can: (e) => e.can().toggleHeaderRow(),
  },
  {
    label: 'Delete row',
    run: (e) => chain(e).deleteRow().run(),
    can: (e) => e.can().deleteRow(),
    danger: true,
  },
  {
    label: 'Delete column',
    run: (e) => chain(e).deleteColumn().run(),
    can: (e) => e.can().deleteColumn(),
    danger: true,
  },
  {
    label: 'Delete table',
    run: (e) => chain(e).deleteTable().run(),
    can: (e) => e.can().deleteTable(),
    danger: true,
  },
];

/** The table element around the selection, if the selection is in one. */
function activeTable(editor: Editor): HTMLElement | null {
  if (!editor.isEditable || !editor.isActive('table')) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      const dom = editor.view.nodeDOM($from.before(depth));
      const table = dom instanceof HTMLElement ? (dom.querySelector('table') ?? dom) : null;
      return table;
    }
  }
  return null;
}

export function TableTools({
  editor,
  host,
}: {
  editor: Editor;
  host: RefObject<HTMLElement | null>;
}) {
  useEditorState(editor);
  const table = activeTable(editor);
  const frame = host.current;
  if (!table || !frame) return null;
  const box = table.getBoundingClientRect();
  const origin = frame.getBoundingClientRect();
  return (
    <div
      role="toolbar"
      aria-label="Table"
      onMouseDown={(event) => event.preventDefault()}
      style={{ top: box.top - origin.top - 40, left: box.left - origin.left }}
      className="absolute z-10 flex flex-wrap items-center gap-0.5 rounded-card border border-br bg-sf p-1 shadow-menu"
    >
      {TOOLS.map((tool) => (
        <Button
          key={tool.label}
          type="button"
          size="xs"
          variant={tool.danger ? 'danger' : 'ghost'}
          disabled={!tool.can(editor)}
          onClick={() => tool.run(editor)}
        >
          {tool.label}
        </Button>
      ))}
    </div>
  );
}
