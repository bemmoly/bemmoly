import { Extension, type Range } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion } from '@tiptap/suggestion';
import type { SuggestionRow, SuggestionStore } from '../editor/suggestion-store.ts';
import type { SuggestionSearch } from '../types.ts';
import type { DocServices } from './services.ts';
import { docSlashItems, filterSlashItems, slashRow } from './slash-items.ts';

/*
 * The Docs editor's lists: / for blocks (and /ai), [[ for pages, # for issues. Each opens in
 * the one SuggestionStore the editor shares with @ people, so they draw as the mock's menu
 * and take the same keys. Services are read when a list opens, so a host may lend a search
 * after the editor was made.
 */

type Services = () => DocServices;

/** Lists never open inside code, where / [ and # are just characters. */
const outsideCode = ({ state, range }: { state: EditorState; range: Range }) =>
  !state.doc.resolve(range.from).parent.type.spec.code;

/** A search that is the host's when it has one, and empty when it does not. */
const lent =
  (pick: (services: DocServices) => SuggestionSearch | undefined, services: Services) =>
  (query: string, signal: AbortSignal) =>
    pick(services())?.(query, signal) ?? Promise.resolve([]);

export function docSlash(store: SuggestionStore, services: Services) {
  return Extension.create({
    name: 'docSlash',
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionRow>({
          editor: this.editor,
          char: '/',
          pluginKey: new PluginKey('docSlash'),
          allow: outsideCode,
          items: ({ query }) => filterSlashItems(docSlashItems(services()), query).map(slashRow),
          command: ({ editor, range, props }) => {
            const item = docSlashItems(services()).find((entry) => entry.id === props.id);
            item?.run(editor, range, services());
          },
          render: store.renderer('slash', 'Blocks'),
        }),
      ];
    },
  });
}

export function pageLinks(store: SuggestionStore, services: Services) {
  return Extension.create({
    name: 'pageLinkSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionRow>({
          editor: this.editor,
          char: '[[',
          pluginKey: new PluginKey('pageLinkSuggestion'),
          allowSpaces: true,
          debounce: 200,
          allow: (props) => outsideCode(props) && Boolean(services().searchPages),
          items: store.searching(lent((s) => s.searchPages, services)),
          command: ({ editor, range, props }) =>
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'pageLink', attrs: { pageId: props.id, title: props.label } },
                { type: 'text', text: ' ' },
              ])
              .run(),
          render: store.renderer('reference', 'Pages'),
        }),
      ];
    },
  });
}

export function issueEmbeds(store: SuggestionStore, services: Services) {
  return Extension.create({
    name: 'issueEmbedSuggestion',
    addProseMirrorPlugins() {
      return [
        Suggestion<SuggestionRow>({
          editor: this.editor,
          char: '#',
          allowedPrefixes: [' ', '('],
          pluginKey: new PluginKey('issueEmbedSuggestion'),
          debounce: 200,
          allow: (props) => outsideCode(props) && Boolean(services().searchIssues),
          items: store.searching(lent((s) => s.searchIssues, services)),
          command: ({ editor, range, props }) =>
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                { type: 'issueEmbed', attrs: { key: props.id } },
                { type: 'text', text: ' ' },
              ])
              .run(),
          render: store.renderer('reference', 'Issues'),
        }),
      ];
    },
  });
}

/** The @ list's options for the schema's mention node, when the host lends a people search. */
export function mentionOptions(store: SuggestionStore, services: Services) {
  return {
    debounce: 200,
    allow: (props: { state: EditorState; range: Range }) =>
      outsideCode(props) && Boolean(services().searchPeople),
    items: store.searching(lent((s) => s.searchPeople, services)),
    render: store.renderer('mention', 'People'),
  };
}
