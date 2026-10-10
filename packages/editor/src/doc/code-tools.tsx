import { focusRing, Menu, MenuItem, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { useEffect, useReducer, useState, type RefObject } from 'react';
import { cx } from '../cx.ts';
import { useEditorState } from '../editor/use-editor.ts';
import { CODE_LANGUAGES, codeLanguage } from '../schema/nodes/code-block.ts';

/*
 * Each code block's language and Copy, in its top right corner: the language picker the
 * schema already lists, and Copy for the block's text. Readers see the language and Copy;
 * writers can change the language, which recolours the block at once. Drawn over the block
 * rather than inside it, so the stored node and its HTML stay as they were.
 */

const CHIP = cx(
  'inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-panel border-0 bg-transparent px-1.75',
  'font-sans text-12 text-tx-2 hover:bg-hover hover:text-tx',
  focusRing,
);

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Tooltip label="Copy code">
      <button
        type="button"
        className={CHIP}
        onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true))}
      >
        <Icon name={copied ? 'check' : 'copy'} size={13} />
        <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </Tooltip>
  );
}

function LanguagePicker({ editor, pos, node }: { editor: Editor; pos: number; node: PmNode }) {
  const current = codeLanguage(String(node.attrs['language'] ?? '')) ?? 'plaintext';
  const label = CODE_LANGUAGES.find((lang) => lang.id === current)?.label ?? 'Plain text';
  if (!editor.isEditable) return <span className="px-1.75 text-12 text-tx-3">{label}</span>;
  return (
    <Menu
      widthClassName="w-48 max-h-80"
      align="end"
      trigger={(props) => (
        <button type="button" {...props} aria-label={`Language, ${label}`} className={CHIP}>
          <Icon name="code" size={13} />
          {label}
          <Icon name="caret" size={11} className="text-tx-3" />
        </button>
      )}
    >
      {CODE_LANGUAGES.map((lang) => (
        <MenuItem
          key={lang.id}
          checked={lang.id === current}
          onSelect={() => {
            editor.view.dispatch(
              editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: lang.id }),
            );
          }}
        >
          {lang.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

export function CodeTools({
  editor,
  host,
}: {
  editor: Editor;
  host: RefObject<HTMLElement | null>;
}) {
  useEditorState(editor);
  /* Draw again once the view is mounted and whenever the page reflows. */
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    editor.on('create', redraw);
    window.addEventListener('resize', redraw);
    return () => {
      editor.off('create', redraw);
      window.removeEventListener('resize', redraw);
    };
  }, [editor]);
  const frame = host.current;
  if (!frame || editor.isDestroyed || !editor.isInitialized) return null;
  const blocks: Array<{ pos: number; node: PmNode }> = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock') blocks.push({ pos, node });
    return !node.isTextblock;
  });
  const origin = frame.getBoundingClientRect();
  return (
    <>
      {blocks.map(({ pos, node }) => {
        const dom = editor.view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) return null;
        const box = dom.getBoundingClientRect();
        return (
          <div
            key={pos}
            role="toolbar"
            aria-label="Code block"
            onMouseDown={(event) => event.preventDefault()}
            style={{ top: box.top - origin.top + 6, right: origin.right - box.right + 8 }}
            className="absolute z-10 flex items-center gap-0.5"
          >
            <LanguagePicker editor={editor} pos={pos} node={node} />
            <CopyButton text={node.textContent} />
          </div>
        );
      })}
    </>
  );
}
