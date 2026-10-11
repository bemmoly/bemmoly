import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import kotlin from 'highlight.js/lib/languages/kotlin';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';
import { codeLanguage } from '../schema/nodes/code-block.ts';
import { escapeHtml } from './options.ts';

/*
 * Code colours for paper. The editor loads each grammar when a page first shows it; a print
 * document is made in one pass, so the same grammars load here at once, only where print is
 * imported. Markup is written from the highlighter's tree: every text escaped, every class
 * one of the highlighter's own `hljs-*` names.
 */

const lowlight = createLowlight({
  bash,
  css,
  diff,
  go,
  java,
  javascript,
  json,
  kotlin,
  markdown,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
});

type Tree = ReturnType<typeof lowlight.highlight>;
type HastNode = Tree['children'][number];

const SAFE_CLASS = /^hljs-[a-z_-]+$/;

function render(node: HastNode): string {
  if (node.type === 'text') return escapeHtml(node.value);
  if (node.type !== 'element') return '';
  const own = node.properties['className'];
  const classes = (Array.isArray(own) ? own.map(String) : []).filter((name) =>
    SAFE_CLASS.test(name),
  );
  const inner = node.children.map(render).join('');
  return classes.length ? `<span class="${classes.join(' ')}">${inner}</span>` : inner;
}

/** Escaped, highlighted markup for code in a known language; null for anything else. */
export function highlightCode(code: string, language: string | null): string | null {
  const lang = codeLanguage(language);
  if (!lang || lang === 'plaintext' || !lowlight.registered(lang)) return null;
  return lowlight.highlight(lang, code).children.map(render).join('');
}
