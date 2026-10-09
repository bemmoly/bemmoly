import { Editor, type AnyExtension, type NodeViewRendererProps } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import { cx } from '../cx.ts';
import type { SuggestionStore } from '../editor/suggestion-store.ts';
import { proseClass } from '../prose.ts';
import { docExtensions } from '../schema/index.ts';
import type { RichTextDoc } from '../types.ts';
import { CodeHighlight } from './highlight.ts';
import { imageDrop } from './image-drop.ts';
import { PortalNodeView, type PortalStore } from './portals.ts';
import type { DocServices } from './services.ts';
import { TABLE } from './styles.ts';
import { docSlash, issueEmbeds, mentionOptions, pageLinks } from './suggestions.ts';
import { NODE_VIEWS } from './views/registry.ts';

export interface CreateDocEditorOptions {
  id: string;
  label: string;
  placeholder: string;
  initialDoc?: RichTextDoc | null | undefined;
  autoFocus?: boolean | undefined;
  editable: boolean;
  /** The host's services as they are now. */
  services: () => DocServices;
  store: SuggestionStore;
  portals: PortalStore;
  /** More extensions, such as collaboration's; they may replace the initial content. */
  extensions?: readonly AnyExtension[] | undefined;
  onUpdate: (editor: Editor) => void;
}

/** ProseMirror's own base styles as classes, plus the empty-line hint the mock shows. */
const PROSEMIRROR = cx(
  'relative min-w-0 whitespace-break-spaces outline-0 [font-variant-ligatures:none]',
  '[&_[contenteditable=false]]:whitespace-normal',
  '[&_img.ProseMirror-separator]:inline [&_img.ProseMirror-separator]:m-0 [&_img.ProseMirror-separator]:border-0',
  '[&_.ProseMirror-selectednode]:rounded-card [&_.ProseMirror-selectednode]:shadow-ring-ac',
  '[&_.ProseMirror-gapcursor]:relative [&_.ProseMirror-gapcursor]:after:absolute [&_.ProseMirror-gapcursor]:after:-top-0.5 [&_.ProseMirror-gapcursor]:after:block [&_.ProseMirror-gapcursor]:after:w-5 [&_.ProseMirror-gapcursor]:after:border-t [&_.ProseMirror-gapcursor]:after:border-tx',
  '[&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-left [&_.is-empty]:before:h-0 [&_.is-empty]:before:text-tx6 [&_.is-empty]:before:content-[attr(data-placeholder)]',
  '[&_.tableWrapper]:min-w-0 [&_.tableWrapper]:overflow-x-auto',
  '[&_[data-type=pageLink]]:cursor-pointer [&_[data-type=pageLink]]:font-medium [&_[data-type=pageLink]]:text-ac',
  '[&_[data-type=unsupportedBlock]]:rounded-card [&_[data-type=unsupportedBlock]]:border [&_[data-type=unsupportedBlock]]:border-dashed [&_[data-type=unsupportedBlock]]:border-br3 [&_[data-type=unsupportedBlock]]:bg-bg2 [&_[data-type=unsupportedBlock]]:px-4 [&_[data-type=unsupportedBlock]]:py-3 [&_[data-type=unsupportedBlock]]:text-13 [&_[data-type=unsupportedBlock]]:text-tx4',
);

/**
 * The schema's extensions as the editor draws them: a portal node view on each node that has
 * one, and the table carrying its classes (the schema's table has none, as exports style
 * their own).
 */
function withViews(extensions: AnyExtension[], portals: PortalStore): AnyExtension[] {
  return extensions.map((extension) => {
    if (extension.name === 'table') {
      return extension.configure({ HTMLAttributes: { class: TABLE }, renderWrapper: true });
    }
    const spec = NODE_VIEWS[extension.name];
    if (!spec || extension.type !== 'node') return extension;
    return extension.extend({
      addNodeView: () => (props: NodeViewRendererProps) => new PortalNodeView(props, spec, portals),
    });
  });
}

/** The Docs editor: every registered node, the / [[ # @ lists and code colours. */
export function createDocEditor(options: CreateDocEditorOptions): Editor {
  const { store, services } = options;
  const schema = docExtensions({
    mention: mentionOptions(store, services),
    references: { pattern: null, suggestion: null },
  });
  return new Editor({
    element: null,
    injectCSS: false,
    editable: options.editable,
    content: options.initialDoc ?? '',
    autofocus: options.autoFocus ? 'end' : false,
    extensions: [
      ...withViews(schema, options.portals),
      Placeholder.configure({ placeholder: options.placeholder, showOnlyCurrent: true }),
      docSlash(store, services),
      pageLinks(store, services),
      issueEmbeds(store, services),
      imageDrop(services),
      CodeHighlight,
      ...(options.extensions ?? []),
    ],
    editorProps: {
      attributes: {
        id: options.id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': options.label,
        class: proseClass('doc', PROSEMIRROR),
      },
      handleClickOn: (_view, _pos, node, _nodePos, event) => {
        if (node.type.name !== 'pageLink') return false;
        const href = services().pageHref?.(String(node.attrs['pageId'] ?? ''));
        if (!href || !(event.metaKey || event.ctrlKey || !options.editable)) return false;
        services().onNavigate?.(href);
        return true;
      },
    },
    onUpdate: ({ editor }) => options.onUpdate(editor),
  });
}
