import { attr, type DocNode } from './types.ts';

/*
 * A code block with a language. The node is the base set's (Work's descriptions have code
 * blocks too) and its `language` attribute is what the highlighter reads; the colours are
 * drawn by the editor and the view, loading a language's grammar the first time it is seen.
 */

/** The languages the picker offers, by the id the highlighter knows them by. */
export const CODE_LANGUAGES = [
  { id: 'plaintext', label: 'Plain text' },
  { id: 'bash', label: 'Bash' },
  { id: 'css', label: 'CSS' },
  { id: 'diff', label: 'Diff' },
  { id: 'go', label: 'Go' },
  { id: 'java', label: 'Java' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'json', label: 'JSON' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'python', label: 'Python' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'rust', label: 'Rust' },
  { id: 'sql', label: 'SQL' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'xml', label: 'HTML / XML' },
  { id: 'yaml', label: 'YAML' },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]['id'];

const ALIASES: Record<string, CodeLanguage> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  yml: 'yaml',
  html: 'xml',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  golang: 'go',
  kt: 'kotlin',
  postgresql: 'sql',
};

/** A language as written in a fence or an import ("ts", "TypeScript") as a picker id. */
export function codeLanguage(value: string | null | undefined): CodeLanguage | null {
  const raw = (value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const known = CODE_LANGUAGES.find((lang) => lang.id === raw || lang.label.toLowerCase() === raw);
  return known?.id ?? ALIASES[raw] ?? null;
}

const textOf = (node: Parameters<NonNullable<DocNode['plainText']>>[0]) =>
  (node.content ?? []).map((child) => child.text ?? '').join('');

export const codeBlock: DocNode = {
  name: 'codeBlock',
  extensions: () => [],
  plainText: textOf,
  toMarkdown: (node) => {
    const code = textOf(node);
    const fence = /```/.test(code) ? '~~~~' : '```';
    return `${fence}${attr(node, 'language')}\n${code}\n${fence}`;
  },
  toHtml: (node, context) => {
    const language = codeLanguage(attr(node, 'language'));
    const cls = language ? ` class="language-${language}"` : '';
    return `<pre><code${cls}>${context.escape(textOf(node))}</code></pre>`;
  },
};
