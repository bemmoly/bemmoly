import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';
import { SAFE_IMAGE_SRC } from './values.ts';

/*
 * An image by URL, with its alt text. Uploading is the host's: the editor hands a file to an
 * injected callback and stores the URL it returns, so the schema never knows where files
 * live. Only web and same-origin sources are rendered; anything else prints its alt text.
 */

export { SAFE_IMAGE_SRC } from './values.ts';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (attrs: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

export const Image = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'img[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = String(HTMLAttributes['src'] ?? '');
    return ['img', mergeAttributes(HTMLAttributes, { src: SAFE_IMAGE_SRC.test(src) ? src : '' })];
  },

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

export const image: DocNode = {
  name: 'image',
  extensions: () => [Image],
  plainText: (node) => attr(node, 'alt'),
  toMarkdown: (node, context) => {
    const src = attr(node, 'src');
    const alt = attr(node, 'alt').replace(/[[\]]/g, '');
    if (!SAFE_IMAGE_SRC.test(src)) return alt;
    return `![${alt}](${context.imageSrc(src).replace(/[()\s]/g, encodeURI)})`;
  },
  toHtml: (node, context) => {
    const src = attr(node, 'src');
    const alt = context.escape(attr(node, 'alt'));
    if (!SAFE_IMAGE_SRC.test(src)) return alt ? `<p>${alt}</p>` : '';
    const chosen = context.imageSrc(src);
    if (!chosen) return alt ? `<p class="image-alt">${alt}</p>` : '';
    const shown = context.escape(chosen);
    return `<figure><img src="${shown}" alt="${alt}" loading="lazy"></figure>`;
  },
};
