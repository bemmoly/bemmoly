import { focusRing, Menu, MenuItem, Tooltip } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Editor } from '@tiptap/core';
import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../cx.ts';
import { useEditorState } from '../editor/use-editor.ts';
import { BUBBLE_TOOLS, type Tool } from '../editor/tools.ts';
import { LinkPicker } from './link-picker.tsx';
import { placeOver } from './place.ts';
import { COMMENT_EVENT, COMMENT_KEYS, DEFAULT_AI_COMMANDS, type DocServices } from './services.ts';
import { refocus, TurnIntoMenu } from './turn-into-menu.tsx';
import { useBubbleOpen } from './use-bubble-open.ts';

/*
 * The selection bubble of the Docs review's Formatting tab: Turn into, bold, italic, strike,
 * code, link, highlight, then Comment, and Ask AI in lilac only when the host lends AI. It sits
 * above the selection (below it when there is no room), never over the line being read, and
 * becomes the ⌘K link field in place. Alt+F10 moves focus into it, ← → walk it, Esc goes back
 * to the text.
 */

const BUTTON = cx(
  'inline-flex h-7.5 min-w-7.5 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border-0 px-1.75',
  'bg-transparent font-sans text-13 whitespace-nowrap text-tx-2 outline-0',
  'hover:bg-hover hover:text-tx',
  focusRing,
);
const ON = 'bg-acc-50 text-acc hover:bg-acc-50 hover:text-acc';
const DIVIDER = 'mx-0.75 h-4.5 w-px shrink-0 bg-line';

const tooltipKeys = (keys?: string) => keys?.replace(/-/g, '+');

function MarkButton({ tool, editor, onLink }: { tool: Tool; editor: Editor; onLink: () => void }) {
  const on = tool.active?.(editor) ?? false;
  return (
    <Tooltip label={tool.label} {...(tool.keys ? { keys: tooltipKeys(tool.keys)! } : {})}>
      <button
        type="button"
        aria-label={tool.label}
        aria-pressed={on}
        onClick={() => tool.run(editor, { openLink: onLink })}
        className={cx(BUTTON, on && ON)}
      >
        <Icon name={tool.icon ?? 'dot'} size={15} />
      </button>
    </Tooltip>
  );
}

function AskAi({ editor, services }: { editor: Editor; services: DocServices }) {
  const ai = services.ai;
  if (!ai) return null;
  const run = (id: string) => {
    const { from, to, $from } = editor.state.selection;
    ai.run(id, {
      blockText: $from.parent.textContent,
      selectionText: editor.state.doc.textBetween(from, to, '\n'),
      insertText: (text) => editor.chain().focus().insertContent(text).run(),
    });
    refocus(editor);
  };
  return (
    <Menu
      align="end"
      widthClassName="w-72"
      trigger={(props) => (
        <button type="button" {...props} className={cx(BUTTON, 'text-ai-600 hover:text-ai-600')}>
          <Icon name="spark" size={15} />
          Ask AI
        </button>
      )}
    >
      {(ai.commands ?? DEFAULT_AI_COMMANDS).map((command) => (
        <MenuItem
          key={command.id}
          icon={<Icon name="spark" size={15} className="text-ai-600" />}
          onSelect={() => run(command.id)}
        >
          {command.label}
        </MenuItem>
      ))}
    </Menu>
  );
}

/** ← → move between the bubble's controls; Esc gives the text its focus back. */
function walk(event: KeyboardEvent<HTMLDivElement>, editor: Editor) {
  if (event.key === 'Escape') {
    event.preventDefault();
    editor.commands.focus();
    return;
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(':scope > button, :scope > div > button'),
  ];
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  event.preventDefault();
  const step = event.key === 'ArrowRight' ? 1 : -1;
  items[(at + step + items.length) % items.length]?.focus();
}

export interface BubbleMenuProps {
  editor: Editor;
  services: DocServices;
  /** The ⌘K field is open in place of the tools. */
  linking: boolean;
  setLinking: (open: boolean) => void;
}

export function BubbleMenu({ editor, services, linking, setLinking }: BubbleMenuProps) {
  useEditorState(editor);
  const ref = useRef<HTMLDivElement>(null);
  const open = useBubbleOpen(editor, ref, linking, Boolean(services.comments));

  /* A click away from the ⌘K field drops it, as Esc does. */
  useEffect(() => {
    if (!linking) return undefined;
    const away = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setLinking(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [linking, setLinking]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      if (ref.current && !editor.isDestroyed) placeOver(editor, ref.current);
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  });

  if (!open) return null;
  const editable = editor.isEditable;
  let body: ReactNode;
  if (linking) {
    body = (
      <LinkPicker
        editor={editor}
        services={services}
        onDone={() => {
          setLinking(false);
          refocus(editor);
        }}
      />
    );
  } else {
    body = (
      <div
        role="toolbar"
        aria-label="Format"
        className="flex h-10 max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto p-1 [scrollbar-width:none]"
        onKeyDown={(event) => walk(event, editor)}
      >
        {editable && (
          <>
            <TurnIntoMenu editor={editor} className={BUTTON} />
            <span aria-hidden className={DIVIDER} />
            {BUBBLE_TOOLS.map((tool) => (
              <MarkButton
                key={tool.id}
                tool={tool}
                editor={editor}
                onLink={() => setLinking(true)}
              />
            ))}
          </>
        )}
        {services.comments && (
          <>
            {editable && <span aria-hidden className={DIVIDER} />}
            <Tooltip label="Comment" keys={tooltipKeys(COMMENT_KEYS)!}>
              <button
                type="button"
                className={BUTTON}
                onClick={() => editor.view.dom.dispatchEvent(new CustomEvent(COMMENT_EVENT))}
              >
                <Icon name="message" size={15} />
                Comment
              </button>
            </Tooltip>
          </>
        )}
        {editable && services.ai && (
          <>
            <span aria-hidden className={DIVIDER} />
            <AskAi editor={editor} services={services} />
          </>
        )}
      </div>
    );
  }
  return createPortal(
    <div
      ref={ref}
      data-bubble-menu=""
      style={{ visibility: 'hidden' }}
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
      className="fixed top-0 left-0 z-40 rounded-dialog bg-card shadow-e2 motion-safe:animate-pop-in"
    >
      {body}
    </div>,
    editor.view.dom.ownerDocument.body,
  );
}
