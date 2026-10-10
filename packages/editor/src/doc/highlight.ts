import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { LanguageFn } from 'highlight.js';
import type { createLowlight } from 'lowlight';
import { codeLanguage, type CodeLanguage } from '../schema/nodes/code-block.ts';

/*
 * Code block colours. The highlighter and each language's grammar load the first time a
 * block in that language is on the page, each as its own small chunk, so a page with no code
 * pays nothing and one with Go pays for Go. Colours are decorations over the text: the
 * stored document never changes, and the server never needs any of this.
 */

type Lowlight = ReturnType<typeof createLowlight>;
type Tree = ReturnType<Lowlight['highlight']>;
type HastNode = Tree['children'][number];

type Grammar = () => Promise<{ default: LanguageFn }>;

const GRAMMARS: Record<Exclude<CodeLanguage, 'plaintext'>, Grammar> = {
  bash: () => import('highlight.js/lib/languages/bash'),
  css: () => import('highlight.js/lib/languages/css'),
  diff: () => import('highlight.js/lib/languages/diff'),
  go: () => import('highlight.js/lib/languages/go'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  python: () => import('highlight.js/lib/languages/python'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  sql: () => import('highlight.js/lib/languages/sql'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
};

let lowlight: Promise<Lowlight> | null = null;
/** The highlighter, once some language has loaded. */
let loaded: Lowlight | null = null;
const loading = new Map<string, Promise<void>>();
const ready = new Set<string>();

/** Loads the highlighter and a language once; later calls share the first load. */
export function loadLanguage(language: CodeLanguage): Promise<void> {
  if (language === 'plaintext') return Promise.resolve();
  const existing = loading.get(language);
  if (existing) return existing;
  lowlight ??= import('lowlight').then(({ createLowlight }) => createLowlight());
  const load = Promise.all([lowlight, GRAMMARS[language]()]).then(([core, grammar]) => {
    core.register(language, grammar.default);
    loaded = core;
    ready.add(language);
  });
  loading.set(language, load);
  return load;
}

/** [from, to, classes] ranges of a highlighted tree, offsets relative to the code. */
export function tokenRanges(tree: Tree): Array<[number, number, string]> {
  const out: Array<[number, number, string]> = [];
  let at = 0;
  const visit = (node: HastNode, classes: string[]) => {
    if (node.type === 'text') {
      if (classes.length) out.push([at, at + node.value.length, classes.join(' ')]);
      at += node.value.length;
      return;
    }
    if (node.type !== 'element') return;
    const own = node.properties['className'];
    const next = Array.isArray(own) ? [...classes, ...own.map(String)] : classes;
    for (const child of node.children) visit(child, next);
  };
  for (const child of tree.children) visit(child, []);
  return out;
}

/** Highlights a code string in a loaded language; null until it has loaded. */
export function highlight(
  code: string,
  language: string | null,
): Array<[number, number, string]> | null {
  const lang = codeLanguage(language);
  if (!lang || lang === 'plaintext' || !ready.has(lang) || !loaded) return null;
  return tokenRanges(loaded.highlight(lang, code));
}

function decorate(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true;
    const ranges = highlight(node.textContent, node.attrs['language'] as string | null);
    for (const [from, to, cls] of ranges ?? []) {
      decorations.push(Decoration.inline(pos + 1 + from, pos + 1 + to, { class: cls }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** Languages on the page whose grammar has not loaded yet. */
function missing(doc: PmNode): CodeLanguage[] {
  const out = new Set<CodeLanguage>();
  doc.descendants((node) => {
    if (node.type.name !== 'codeBlock') return true;
    const lang = codeLanguage(node.attrs['language'] as string | null);
    if (lang && lang !== 'plaintext' && !ready.has(lang)) out.add(lang);
    return false;
  });
  return [...out];
}

const key = new PluginKey<DecorationSet>('codeHighlight');

export const CodeHighlight = Extension.create({
  name: 'codeHighlight',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old) =>
            tr.docChanged || tr.getMeta(key) ? decorate(tr.doc) : old.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => key.getState(state) },
        view: (view) => {
          /* Each editor waits for a language once, so a grammar that failed is not retried. */
          const awaited = new Set<CodeLanguage>();
          const check = () => {
            const wanted = missing(view.state.doc).filter((lang) => !awaited.has(lang));
            if (wanted.length === 0) return;
            for (const lang of wanted) awaited.add(lang);
            // A grammar that fails to load (offline, say) leaves its code plain, not broken.
            void Promise.allSettled(wanted.map(loadLanguage)).then(() => {
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(key, true));
            });
          };
          check();
          return { update: check };
        },
      }),
    ];
  },
});
