import type { Editor } from '@tiptap/core';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { EditorParts, RichTextEditorProps } from '../editor-props.ts';
import type { RichTextDoc } from '../types.ts';
import { createEditor } from './create.ts';
import { LinkForm } from './link-form.tsx';
import { optionId, SuggestionList } from './suggestion-list.tsx';
import { SuggestionStore } from './suggestion-store.ts';
import { Toolbar } from './toolbar.tsx';
import { BLOCK_TOOLS, INLINE_TOOLS } from './tools.ts';
import { useMountedEditor } from './use-editor.ts';

const defaultLayout = ({ content, toolbar }: EditorParts) => (
  <div className="flex flex-col gap-2.5">
    {content}
    {toolbar}
  </div>
);

/** The stored shape of what is written, or null for an empty editor. */
export const docOf = (editor: Editor): RichTextDoc | null =>
  editor.isEmpty ? null : (editor.getJSON() as RichTextDoc);

/**
 * The rich text editor: the schema, the tool row, @ people, # records and / blocks. Loaded on
 * first use through RichTextEditor in the package entry, so its weight is never in a page that
 * only reads documents.
 */
export default function RichTextEditor(props: RichTextEditorProps) {
  const { label, blocks = false, size = 'page', children = defaultLayout } = props;
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const id = useId();
  const textId = `${id}-text`;
  const listId = `${id}-list`;
  const toolbarId = `${id}-tools`;
  const [store] = useState(() => new SuggestionStore());
  const [linking, setLinking] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  const editor = useMountedEditor(
    () =>
      createEditor({
        id: textId,
        label,
        placeholder: props.placeholder,
        initialDoc: props.initialDoc,
        sources: props.sources,
        autoFocus: props.autoFocus,
        size,
        contentClassName: props.contentClassName,
        store,
        keys: {
          submit: () => latest.current.onSubmit?.(),
          cancel: () => latest.current.onCancel?.(),
          link: () => setLinking(true),
          toolbar: () =>
            document
              .getElementById(toolbarId)
              ?.querySelector<HTMLElement>('[tabindex="0"]')
              ?.focus(),
        },
        onUpdate: (instance) => latest.current.onChange?.(docOf(instance)),
      }),
    host,
  );

  /* The text box points at the active row of an open list, as a combobox would. */
  useEffect(
    () =>
      store.subscribe(() => {
        const dom = host.current?.querySelector(`[id="${textId}"]`);
        if (!dom) return;
        const open = store.get();
        if (open) {
          dom.setAttribute('aria-controls', listId);
          dom.setAttribute('aria-autocomplete', 'list');
          if (open.items.length > 0) {
            dom.setAttribute('aria-activedescendant', optionId(listId, open.active));
          } else dom.removeAttribute('aria-activedescendant');
        } else {
          for (const name of ['aria-controls', 'aria-autocomplete', 'aria-activedescendant']) {
            dom.removeAttribute(name);
          }
        }
      }),
    [store, textId, listId],
  );

  const content = (
    <>
      <div ref={host} className="min-w-0" />
      <SuggestionList store={store} listId={listId} />
    </>
  );
  const toolbar = linking ? (
    <LinkForm
      editor={editor}
      onDone={() => {
        setLinking(false);
        editor.commands.focus();
      }}
    />
  ) : (
    <Toolbar
      id={toolbarId}
      editor={editor}
      groups={blocks ? [INLINE_TOOLS, BLOCK_TOOLS] : [INLINE_TOOLS]}
      context={{ openLink: () => setLinking(true) }}
      label={`${label} formatting`}
      controls={textId}
      onEscape={() => editor.commands.focus()}
    />
  );
  return children({ content, toolbar, ready: true });
}
