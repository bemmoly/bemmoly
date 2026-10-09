import { ComposerTool } from '@bemmoly/ui';
import type { Editor } from '@tiptap/core';
import { Fragment, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '../cx.ts';
import { ariaKeys, keyLabel, type Tool, type ToolContext } from './tools.ts';
import { useEditorState } from './use-editor.ts';

export interface ToolbarProps {
  id: string;
  editor: Editor;
  /** Groups of tools, with a rule between groups. */
  groups: ReadonlyArray<readonly Tool[]>;
  context: ToolContext;
  /** Names the toolbar: "Comment formatting". */
  label: string;
  /** The id of the editor the tools act on. */
  controls: string;
  /** Escape from the toolbar hands focus back to the text. */
  onEscape: () => void;
}

const MOVES: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_i, n) => n - 1,
};

/**
 * The tool row: one tab stop, arrows and Home/End move between tools (the roving tabindex of
 * the ARIA toolbar pattern), Escape returns to the text. Tools keep the editor's selection, so
 * a click formats what was selected.
 */
export function Toolbar({ id, editor, groups, context, label, controls, onEscape }: ToolbarProps) {
  useEditorState(editor);
  const [current, setCurrent] = useState(0);
  const row = useRef<HTMLDivElement>(null);
  const tools = groups.flat();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onEscape();
      return;
    }
    const move = MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move(current, tools.length);
    setCurrent(next);
    row.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  };

  const starts = groups.map((_, g) =>
    groups.slice(0, g).reduce((sum, list) => sum + list.length, 0),
  );
  return (
    <div
      ref={row}
      id={id}
      role="toolbar"
      aria-label={label}
      aria-controls={controls}
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-2.5"
    >
      {groups.map((group, groupIndex) => (
        <Fragment key={groupIndex}>
          {groupIndex > 0 && (
            <span role="separator" aria-orientation="vertical" className="h-3 w-px bg-br2" />
          )}
          {group.map((tool, i) => {
            const at = starts[groupIndex]! + i;
            const pressed = tool.active?.(editor);
            const shortcut = tool.keys ? ` (${keyLabel(tool.keys)})` : '';
            return (
              <ComposerTool
                key={tool.id}
                label={tool.label}
                title={`${tool.label}${shortcut}`}
                tabIndex={at === current ? 0 : -1}
                aria-pressed={tool.active ? Boolean(pressed) : undefined}
                aria-keyshortcuts={tool.keys ? ariaKeys(tool.keys) : undefined}
                onFocus={() => setCurrent(at)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => tool.run(editor, context)}
                className={cx(
                  tool.id === 'bold' && 'font-semibold',
                  tool.id === 'italic' && 'italic',
                  pressed && 'text-ac hover:text-ac',
                )}
              >
                {tool.glyph}
              </ComposerTool>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}
