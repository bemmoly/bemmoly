import { Button } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import { Fragment, useEffect, useReducer, type RefObject } from 'react';
import { cx } from '../cx.ts';
import { useEditorState } from '../editor/use-editor.ts';

/*
 * The table's tools, over the table the caret is in: add and remove rows and columns, turn
 * the header row on or off, delete the table. A table has no tools in the mock, so they take
 * the menu's surface and the ghost buttons, one short row above the table, and appear only
 * while a cell holds the caret.
 */

interface TableTool {
  /** What the button shows. */
  short: string;
  /** What it is called. */
  label: string;
  run: (editor: Editor) => boolean;
  can: (editor: Editor) => boolean;
  danger?: boolean;
}

const chain = (editor: Editor) => editor.chain().focus();

const GROUPS: ReadonlyArray<readonly TableTool[]> = [
  [
    {
      short: '+ Row',
      label: 'Add row below',
      run: (e) => chain(e).addRowAfter().run(),
      can: (e) => e.can().addRowAfter(),
    },
    {
      short: '+ Column',
      label: 'Add column right',
      run: (e) => chain(e).addColumnAfter().run(),
      can: (e) => e.can().addColumnAfter(),
    },
    {
      short: 'Header',
      label: 'Header row',
      run: (e) => chain(e).toggleHeaderRow().run(),
      can: (e) => e.can().toggleHeaderRow(),
    },
  ],
  [
    {
      short: '− Row',
      label: 'Delete row',
      run: (e) => chain(e).deleteRow().run(),
      can: (e) => e.can().deleteRow(),
      danger: true,
    },
    {
      short: '− Column',
      label: 'Delete column',
      run: (e) => chain(e).deleteColumn().run(),
      can: (e) => e.can().deleteColumn(),
      danger: true,
    },
    {
      short: 'Delete table',
      label: 'Delete table',
      run: (e) => chain(e).deleteTable().run(),
      can: (e) => e.can().deleteTable(),
      danger: true,
    },
  ],
];

/** The table element around the selection, if the selection is in one. */
function activeTable(editor: Editor): HTMLElement | null {
  if (!editor.isInitialized || !editor.isEditable || !editor.isActive('table')) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === 'table') {
      const dom = editor.view.nodeDOM($from.before(depth));
      return dom instanceof HTMLElement ? (dom.querySelector('table') ?? dom) : null;
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
  /* The view exists only once the editor is mounted; draw again when it is. */
  const [, mounted] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    editor.on('create', mounted);
    return () => void editor.off('create', mounted);
  }, [editor]);
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
      style={{ top: box.top - origin.top - 6, left: box.left - origin.left }}
      className="absolute z-10 flex -translate-y-full items-center gap-0.5 rounded-card border border-br bg-sf p-1 shadow-menu"
    >
      {GROUPS.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span role="separator" aria-orientation="vertical" className="mx-1 h-4 w-px bg-br2" />
          )}
          {group.map((tool) => (
            <Button
              key={tool.label}
              type="button"
              size="xs"
              variant="ghost"
              aria-label={tool.label}
              title={tool.label}
              disabled={!tool.can(editor)}
              onClick={() => tool.run(editor)}
              className={cx(tool.danger && 'text-danger')}
            >
              {tool.short}
            </Button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
