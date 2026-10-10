import { IconButton } from '@bemmoly/ui';
import type { IconName } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import { Fragment, useEffect, useReducer, type RefObject } from 'react';
import { cx } from '../cx.ts';
import { useEditorState } from '../editor/use-editor.ts';

/*
 * The table's tools, over the table the caret is in: add and remove rows and columns, turn
 * the header row on or off, delete the table. Icon buttons from the one icon set, each named
 * by its tooltip (the Docs review's components: "table tools all draw from the one icon set"),
 * on the popover surface, one short row above the table while a cell holds the caret.
 */

interface TableTool {
  icon: IconName;
  /** What it is called, in its tooltip and to assistive tech. */
  label: string;
  run: (editor: Editor) => boolean;
  can: (editor: Editor) => boolean;
  danger?: boolean;
}

const chain = (editor: Editor) => editor.chain().focus();

const GROUPS: ReadonlyArray<readonly TableTool[]> = [
  [
    {
      icon: 'row-add',
      label: 'Add row below',
      run: (e) => chain(e).addRowAfter().run(),
      can: (e) => e.can().addRowAfter(),
    },
    {
      icon: 'column-add',
      label: 'Add column right',
      run: (e) => chain(e).addColumnAfter().run(),
      can: (e) => e.can().addColumnAfter(),
    },
    {
      icon: 'header-row',
      label: 'Header row',
      run: (e) => chain(e).toggleHeaderRow().run(),
      can: (e) => e.can().toggleHeaderRow(),
    },
  ],
  [
    {
      icon: 'row-remove',
      label: 'Delete row',
      run: (e) => chain(e).deleteRow().run(),
      can: (e) => e.can().deleteRow(),
      danger: true,
    },
    {
      icon: 'column-remove',
      label: 'Delete column',
      run: (e) => chain(e).deleteColumn().run(),
      can: (e) => e.can().deleteColumn(),
      danger: true,
    },
    {
      icon: 'trash-can',
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
      className="absolute z-10 flex -translate-y-full items-center gap-0.5 rounded-dialog bg-card p-1 shadow-e2"
    >
      {GROUPS.map((group, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <span role="separator" aria-orientation="vertical" className="mx-1 h-4 w-px bg-line" />
          )}
          {group.map((tool) => (
            <IconButton
              key={tool.label}
              size="xs"
              label={tool.label}
              icon={tool.icon}
              disabled={!tool.can(editor)}
              onClick={() => tool.run(editor)}
              className={cx(tool.danger && 'text-red enabled:hover:text-red')}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
