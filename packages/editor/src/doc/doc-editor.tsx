import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { optionId, SuggestionList } from '../editor/suggestion-list.tsx';
import { SuggestionStore } from '../editor/suggestion-store.ts';
import { useMountedEditor } from '../editor/use-editor.ts';
import type { RichTextDoc } from '../types.ts';
import { DocServicesContext } from './context.ts';
import { docPlaceholder } from './services.ts';
import { createDocEditor } from './create-doc-editor.ts';
import type { DocEditorProps } from './doc-editor-props.ts';
import { NodeViewPortals } from './node-view-portals.tsx';
import { PortalStore } from './portals.ts';
import { BubbleMenu } from './bubble-menu.tsx';
import { TableTools } from './table-tools.tsx';

const NO_SERVICES = {};

/**
 * The Docs editor: a page's body with every registered node, the / menu, [[ page links,
 * # issues and @ people, and code colours. Loaded on first use through DocEditor in the
 * package entry, like the rich text editor.
 */
export default function DocEditor(props: DocEditorProps) {
  const { label, editable = true } = props;
  const services = props.services ?? NO_SERVICES;
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const id = useId();
  const textId = `${id}-text`;
  const listId = `${id}-list`;
  const [store] = useState(() => new SuggestionStore());
  const [portals] = useState(() => new PortalStore());
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [linking, setLinking] = useState(false);

  const editor = useMountedEditor(
    () =>
      createDocEditor({
        id: textId,
        label,
        placeholder: props.placeholder ?? docPlaceholder(Boolean(props.services?.ai)),
        initialDoc: props.initialDoc,
        autoFocus: props.autoFocus,
        editable,
        services: () => latest.current.services ?? NO_SERVICES,
        store,
        portals,
        extensions: props.extensions,
        onUpdate: (instance) =>
          latest.current.onChange?.(instance.isEmpty ? null : (instance.getJSON() as RichTextDoc)),
        keys: {
          link: () => setLinking(true),
          toolbar: () => document.querySelector<HTMLElement>('[data-bubble-menu] button')?.focus(),
        },
      }),
    host,
  );

  useEffect(() => {
    if (editor.isEditable !== editable) editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    latest.current.onEditor?.(editor);
    return () => latest.current.onEditor?.(null);
  }, [editor]);

  /* The text box points at the active row of an open list, as a combobox would. */
  useEffect(
    () =>
      store.subscribe(() => {
        const dom = host.current?.querySelector(`[id="${textId}"]`);
        if (!dom) return;
        const open = store.get();
        if (open?.items.length) {
          dom.setAttribute('aria-controls', listId);
          dom.setAttribute('aria-activedescendant', optionId(listId, open.active));
        } else {
          dom.removeAttribute('aria-activedescendant');
          if (!open) dom.removeAttribute('aria-controls');
        }
        if (open) dom.setAttribute('aria-autocomplete', 'list');
        else dom.removeAttribute('aria-autocomplete');
      }),
    [store, textId, listId],
  );

  return (
    <DocServicesContext.Provider value={services}>
      <div ref={frame} className="relative min-w-0">
        <div ref={host} className={props.contentClassName ?? 'min-w-0'} />
        <SuggestionList store={store} listId={listId} page />
        <NodeViewPortals store={portals} />
        <TableTools editor={editor} host={frame} />
        <BubbleMenu editor={editor} services={services} linking={linking} setLinking={setLinking} />
      </div>
    </DocServicesContext.Provider>
  );
}
