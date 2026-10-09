import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * A callout: a tinted box around blocks. The variants are the tints the Doc Editor mock
 * uses: info is the TL;DR box's accent tint, warning the amber of a highlighted passage,
 * and success, danger and note the remaining status pairs, so every callout reads in both
 * light and dark from the theme's tokens.
 */

export const CALLOUT_VARIANTS = ['info', 'note', 'success', 'warning', 'danger'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

const isVariant = (value: unknown): value is CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant);

/** The label a callout prints in Markdown and reads out to assistive technology. */
export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  info: 'Info',
  note: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** Wraps the selected blocks in a callout. */
      setCallout: (variant?: CalloutVariant) => ReturnType;
      /** Changes the variant of the callout around the selection. */
      setCalloutVariant: (variant: CalloutVariant) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => {
          const value = element.getAttribute('data-variant');
          return isVariant(value) ? value : 'info';
        },
        renderHTML: (attributes) => ({ 'data-variant': attributes['variant'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0];
  },

  addCommands() {
    return {
      setCallout:
        (variant = 'info') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { variant }),
      setCalloutVariant:
        (variant) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { variant }),
    };
  },
});

export const callout: DocNode = {
  name: 'callout',
  extensions: () => [Callout],
  toMarkdown: (node, context) => {
    const variant = attr(node, 'variant', 'info');
    const label = isVariant(variant) ? variant.toUpperCase() : 'NOTE';
    const body = context.blocks(node.content);
    return [`> [!${label}]`, ...body.split('\n').map((line) => (line ? `> ${line}` : '>'))].join(
      '\n',
    );
  },
  toHtml: (node, context) => {
    const variant = attr(node, 'variant', 'info');
    const safe = isVariant(variant) ? variant : 'info';
    return `<aside class="callout callout-${safe}" data-type="callout" data-variant="${safe}">${context.blocks(node.content)}</aside>`;
  },
};
