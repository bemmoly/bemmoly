import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';
import { SAFE_IMAGE_SRC } from './values.ts';

/*
 * A stored HTML or PDF file shown in place: its URL, its name and the type the server read
 * from its bytes. Like an image, the host uploads and the node keeps only the URL. Markdown
 * writes it with image syntax so a page read and written back by an agent keeps the block;
 * HTML and print write a link, never the file itself.
 */

export const FILE_TYPES = ['text/html', 'application/pdf'] as const;

const isFileType = (mime: string) => (FILE_TYPES as readonly string[]).includes(mime);

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    file: {
      setFile: (attrs: { src: string; name: string; mime: string }) => ReturnType;
    };
  }
}

export const File = Node.create({
  name: 'file',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '', parseHTML: (el) => el.getAttribute('data-src') ?? '' },
      name: { default: '', parseHTML: (el) => el.getAttribute('data-name') ?? '' },
      mime: { default: '', parseHTML: (el) => el.getAttribute('data-mime') ?? '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = String(node.attrs['src'] ?? '');
    const name = String(node.attrs['name'] ?? '');
    return [
      'div',
      mergeAttributes(
        { class: HTMLAttributes['class'] },
        {
          'data-type': 'file',
          'data-src': SAFE_IMAGE_SRC.test(src) ? src : '',
          'data-name': name,
          'data-mime': String(node.attrs['mime'] ?? ''),
        },
      ),
      name,
    ];
  },

  addCommands() {
    return {
      setFile:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

/** The name a reader sees; a file with none is named by its kind. */
export function fileName(name: string, mime: string): string {
  return name || (mime === 'application/pdf' ? 'PDF file' : 'HTML file');
}

export const file: DocNode = {
  name: 'file',
  extensions: () => [File],
  plainText: (node) => fileName(attr(node, 'name'), attr(node, 'mime')),
  toMarkdown: (node, context) => {
    const src = attr(node, 'src');
    const name = fileName(attr(node, 'name'), attr(node, 'mime')).replace(/[[\]]/g, '');
    if (!SAFE_IMAGE_SRC.test(src) || !isFileType(attr(node, 'mime'))) return name;
    return `![${name}](${context.imageSrc(src).replace(/[()\s]/g, encodeURI)})`;
  },
  toHtml: (node, context) => {
    const src = attr(node, 'src');
    const name = context.escape(fileName(attr(node, 'name'), attr(node, 'mime')));
    const chosen = SAFE_IMAGE_SRC.test(src) ? context.imageSrc(src) : '';
    if (!chosen) return `<p class="file-link">${name}</p>`;
    return `<p class="file-link"><a href="${context.escape(chosen)}">${name}</a></p>`;
  },
};
