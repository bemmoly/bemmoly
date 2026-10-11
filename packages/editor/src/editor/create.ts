import { Editor, Extension, type Range } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import type { EditorState } from '@tiptap/pm/state';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { cx } from '../cx.ts';
import { proseClass } from '../prose.ts';
import { baseExtensions } from '../schema/base.ts';
import type { EditorSources, ProseSize, RichTextDoc } from '../types.ts';
import type { SuggestionRow, SuggestionStore } from './suggestion-store.ts';
import { SLASH_BLOCKS, slashMatches } from './tools.ts';

/** What the person's keys ask of the component around the editor. */
export interface EditorKeys {
  submit: () => void;
  cancel: () => void;
  link: () => void;
  toolbar: () => void;
}

export interface CreateEditorOptions {
  id: string;
  label: string;
  placeholder?: string | undefined;
  initialDoc?: RichTextDoc | null | undefined;
  sources?: EditorSources | undefined;
  autoFocus?: boolean | undefined;
  size: ProseSize;
  contentClassName?: string | undefined;
  store: SuggestionStore;
  keys: EditorKeys;
  onUpdate: (editor: Editor) => void;
}

/** ProseMirror's own base styles, as classes: the server's CSP allows no injected stylesheet. */
const PROSEMIRROR = cx(
  'relative min-w-0 whitespace-break-spaces outline-0 [font-variant-ligatures:none]',
  '[&_[contenteditable=false]]:whitespace-normal',
  '[&_img.ProseMirror-separator]:inline [&_img.ProseMirror-separator]:m-0 [&_img.ProseMirror-separator]:border-0',
  '[&_.ProseMirror-selectednode]:rounded-chip [&_.ProseMirror-selectednode]:bg-acc-50',
  '[&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-tx-3 [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
);

/** Suggestions never open inside code, where @ and # are just characters. */
const outsideCode = ({ state, range }: { state: EditorState; range: Range }) =>
  !state.doc.resolve(range.from).parent.type.spec.code;

function slashCommands(store: SuggestionStore) {
  return Extension.create({
    name: 'slashCommands',
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionRow>({
          editor: this.editor,
          char: '/',
          pluginKey: new PluginKey('slash'),
          allow: outsideCode,
          items: ({ query }) =>
            slashMatches(query).map((block) => ({
              id: block.id,
              label: block.label,
              group: 'Blocks',
            })),
          command: ({ editor, range, props }) => {
            const block = SLASH_BLOCKS.find((entry) => entry.id === props.id);
            if (block) block.run(editor.chain().focus().deleteRange(range)).run();
          },
          render: store.renderer('slash', 'Blocks'),
        }),
      ];
    },
  });
}

function shortcuts(store: SuggestionStore, keys: EditorKeys) {
  return Extension.create({
    name: 'composerKeys',
    addKeyboardShortcuts() {
      return {
        'Mod-Enter': () => {
          keys.submit();
          return true;
        },
        Escape: () => {
          if (store.isOpen) return false;
          keys.cancel();
          return true;
        },
        'Mod-k': () => {
          keys.link();
          return true;
        },
        'Alt-F10': () => {
          keys.toolbar();
          return true;
        },
      };
    },
  });
}

export function createEditor(options: CreateEditorOptions): Editor {
  const { store, sources } = options;
  const people = sources?.people;
  const references = sources?.references;
  return new Editor({
    element: null,
    injectCSS: false,
    content: options.initialDoc ?? '',
    autofocus: options.autoFocus ? 'end' : false,
    extensions: [
      ...baseExtensions({
        ...(people
          ? {
              mention: {
                debounce: 200,
                allow: outsideCode,
                items: store.searching(people),
                render: store.renderer('mention', 'People'),
                command: ({ editor, range, props }) =>
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(range, [
                      {
                        type: 'mention',
                        attrs: { id: props.id, label: props.label, mentionSuggestionChar: '@' },
                      },
                      { type: 'text', text: ' ' },
                    ])
                    .run(),
              },
            }
          : {}),
        ...(references
          ? {
              references: {
                pattern: references.pattern,
                hrefFor: references.hrefFor,
                suggestion: {
                  debounce: 200,
                  allow: outsideCode,
                  items: store.searching(references.search),
                  render: store.renderer('reference', references.label),
                  command: ({ editor, range, props }) => {
                    const href = references.hrefFor(props.id);
                    editor
                      .chain()
                      .focus()
                      .insertContentAt(range, [
                        {
                          type: 'text',
                          text: props.id,
                          marks: [{ type: 'link', attrs: { href } }],
                        },
                        { type: 'text', text: ' ' },
                      ])
                      .run();
                  },
                },
              },
            }
          : {}),
      }),
      Placeholder.configure({ placeholder: options.placeholder ?? '' }),
      slashCommands(store),
      shortcuts(store, options.keys),
    ],
    editorProps: {
      attributes: {
        id: options.id,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': options.label,
        class: proseClass(options.size, cx(PROSEMIRROR, options.contentClassName)),
      },
    },
    onUpdate: ({ editor }) => options.onUpdate(editor),
  });
}
