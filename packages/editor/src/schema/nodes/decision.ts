import { mergeAttributes, Node } from '@tiptap/core';
import { attr, type DocNode } from './types.ts';

/*
 * A decision: what was decided, its state and the day it was made. It is a block of its own
 * rather than a styled paragraph so Docs can list a page's decisions, and so a decision log
 * reads as entries the AI and search can find by state.
 */

export const DECISION_STATES = ['proposed', 'decided', 'superseded'] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

const isState = (value: unknown): value is DecisionState =>
  DECISION_STATES.includes(value as DecisionState);

export const DECISION_LABELS: Record<DecisionState, string> = {
  proposed: 'Proposed',
  decided: 'Decided',
  superseded: 'Superseded',
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    decision: {
      /** Wraps the selected blocks in a decision. */
      setDecision: (state?: DecisionState) => ReturnType;
      /** Sets the state (and, when decided, the day) of the decision around the selection. */
      setDecisionState: (state: DecisionState, decidedOn?: string | null) => ReturnType;
    };
  }
}

export const Decision = Node.create({
  name: 'decision',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      state: {
        default: 'proposed',
        parseHTML: (element) => {
          const value = element.getAttribute('data-state');
          return isState(value) ? value : 'proposed';
        },
        renderHTML: (attributes) => ({ 'data-state': attributes['state'] }),
      },
      decidedOn: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-decided-on'),
        renderHTML: (attributes) =>
          attributes['decidedOn'] ? { 'data-decided-on': attributes['decidedOn'] } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="decision"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'decision' }), 0];
  },

  addCommands() {
    return {
      setDecision:
        (state = 'proposed') =>
        ({ commands }) =>
          commands.wrapIn(this.name, { state }),
      setDecisionState:
        (state, decidedOn = null) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { state, decidedOn }),
    };
  },
});

/** "Decided · 2026-10-07", the line a decision prints above its text. */
export function decisionHeading(state: string, decidedOn: string): string {
  const label = isState(state) ? DECISION_LABELS[state] : DECISION_LABELS.proposed;
  return decidedOn ? `${label} · ${decidedOn}` : label;
}

export const decision: DocNode = {
  name: 'decision',
  extensions: () => [Decision],
  toMarkdown: (node, context) => {
    const heading = decisionHeading(attr(node, 'state'), attr(node, 'decidedOn'));
    const body = context.blocks(node.content);
    return [`> **Decision: ${heading}**`, '>', ...body.split('\n').map((l) => `> ${l}`.trimEnd())]
      .join('\n')
      .replace(/\n>$/, '');
  },
  toHtml: (node, context) => {
    const state = attr(node, 'state', 'proposed');
    const safe = isState(state) ? state : 'proposed';
    const heading = context.escape(decisionHeading(safe, attr(node, 'decidedOn')));
    return `<section class="decision" data-type="decision" data-state="${safe}"><p class="decision-label">Decision: ${heading}</p>${context.blocks(node.content)}</section>`;
  },
};
