import { Editor, Extension, type Range } from '@tiptap/core';
import { Placeholder } from '@tiptap/extensions';
import type { EditorState } from '@tiptap/pm/state';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import { fromMarkdownBase } from '../convert/markdown-base.ts';
import { cx } from '../cx.ts';
import { joinLines, looksLikeMarkdown } from '../markdown-lines.ts';
import { proseClass } from '../prose.ts';
import { baseExtensions } from '../schema/base.ts';
import { table } from '../schema/nodes/table.ts';
import { TABLE } from '../doc/styles.ts';
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
  '[&_.tableWrapper]:min-w-0 [&_.tableWrapper]:overflow-x-auto',
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

/**
 * Markdown pasted as plain text (from an editor, a terminal or a PR body) lands formatted, as
 * typing it would. Rich clipboard HTML keeps ProseMirror's own handling; code editors put
 * HTML on the clipboard too, so theirs is read as the text. Inside a code block it stays text.
 */
function markdownPaste() {
  return Extension.create({
    name: 'markdownPaste',
    addProseMirrorPlugins() {
      const editor = this.editor;
      return [
        new Plugin({
          key: new PluginKey('markdownPaste'),
          props: {
            handlePaste: (view, event, slice) => {
              const data = event.clipboardData;
              if (data?.getData('text/html') && !data.types.includes('vscode-editor-data')) {
                return false;
              }
              // Without clipboard data (pasteText), the slice's lines are the text.
              const lines: string[] = [];
              slice.content.forEach((block) => {
                if (block.textContent.trim()) lines.push(block.textContent);
              });
              const text = data?.getData('text/plain') || joinLines(lines);
              if (!text.trim()) return false;
              if (view.state.selection.$from.parent.type.spec.code) return false;
              if (!looksLikeMarkdown(text.split('\n'))) return false;
              const content = fromMarkdownBase(text).content ?? [];
              return editor.chain().focus().insertContent(content).run();
            },
          },
        }),
      ];
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
      // Tables, carrying the classes the read-only view draws them with (doc/styles.ts).
      ...table
        .extensions()
        .map((extension) =>
          extension.name === 'table'
            ? extension.configure({ HTMLAttributes: { class: TABLE }, renderWrapper: true })
            : extension,
        ),
      Placeholder.configure({ placeholder: options.placeholder ?? '' }),
      slashCommands(store),
      markdownPaste(),
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
