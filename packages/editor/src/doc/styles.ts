import type { CalloutVariant, DecisionState } from '../schema/nodes/values.ts';

/*
 * The class lists of the Docs nodes, shared by the editor's node views and the read-only
 * view so a page looks the same before and after Edit. Measures are the Doc Editor mock's:
 * the TL;DR box (8px radius, 12px 16px, 13.5px at 1.55, a 7px dot and a 12.5px label), the
 * inline issue chip, and the 320px menu's type. Colours are tokens only.
 */

export const CALLOUT_BOX: Record<CalloutVariant, string> = {
  info: 'border-acc-100 bg-acc-50',
  note: 'border-line bg-side',
  success: 'border-green-50 bg-green-50',
  warning: 'border-amber-bg bg-amber-bg',
  danger: 'border-amber-50 bg-amber-50',
};

/** The dot and label colour of each variant. */
export const CALLOUT_INK: Record<CalloutVariant, { dot: string; label: string }> = {
  info: { dot: 'bg-acc', label: 'text-acc' },
  note: { dot: 'bg-tx-3', label: 'text-tx-3' },
  success: { dot: 'bg-green', label: 'text-green-tx' },
  warning: { dot: 'bg-amber', label: 'text-amber-fg' },
  danger: { dot: 'bg-amber', label: 'text-amber-tx' },
};

export const calloutClass = (variant: CalloutVariant) =>
  `flex flex-col gap-1.5 rounded-card border px-4 py-3 text-13 leading-brief ${CALLOUT_BOX[variant]}`;

/** The header row of a callout or decision: dot, label, and anything at the right. */
export const NODE_HEADER =
  'flex items-center gap-1.75 text-13 leading-brief font-semibold select-none [&>[data-dot]]:size-1.75 [&>[data-dot]]:shrink-0 [&>[data-dot]]:rounded-full';

/** The blocks inside a callout or decision. */
export const NODE_BODY = 'flex min-w-0 flex-col gap-1.5 [&_p]:m-0';

export const DECISION_BOX =
  'flex flex-col gap-1.5 rounded-card border border-line border-l-3 bg-card px-4 py-3 text-14 leading-body';

export const DECISION_INK: Record<DecisionState, { border: string; pill: string }> = {
  proposed: { border: 'border-l-amber', pill: 'bg-amber-bg text-amber-fg' },
  decided: { border: 'border-l-green', pill: 'bg-green-50 text-green-tx' },
  superseded: { border: 'border-l-line', pill: 'bg-line-2 text-tx-3' },
};

export const STATE_PILL =
  'rounded-chip px-1.5 py-px text-11 font-semibold tracking-status uppercase';

export const TOC_BOX =
  'flex flex-col gap-0.5 border-l-2 border-line-2 py-0.5 pl-3 text-13 leading-body';
/** Indent by depth below the outline's top level. */
export const TOC_INDENT: Record<number, string> = { 1: '', 2: 'pl-4', 3: 'pl-8' };
export const TOC_LINK = 'truncate text-tx-2 no-underline hover:text-acc';

/** A table that scrolls sideways inside the page's measure rather than widening it. */
export const TABLE_WRAP = 'min-w-0 overflow-x-auto';
export const TABLE =
  'w-full border-collapse text-13 leading-body [&_td]:border [&_td]:border-line [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:border-line [&_th]:bg-side [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:text-tx [&_p]:m-0 [&_.selectedCell]:bg-acc-50';

export const IMAGE_FRAME = 'flex flex-col items-start gap-1.5';
export const IMAGE = 'max-w-full rounded-card border border-line';
export const IMAGE_CAPTION = 'text-13 text-tx-3';

/** The quiet dashed card a node shows when its live content cannot be drawn. */
export const PLACEHOLDER_CARD =
  'flex flex-col gap-1 rounded-card border border-dashed border-line bg-side px-4 py-3 text-13 leading-body text-tx-3';
export const PLACEHOLDER_TITLE = 'text-13 font-semibold text-tx-2';

export const PAGE_LINK = 'cursor-pointer text-acc no-underline hover:text-acc-600';

/** The mock's inline issue chip (KeyChip inline), with a neutral square when nothing is live. */
export const ISSUE_CHIP =
  'inline-flex items-center gap-1.25 rounded-chip border border-line bg-card px-1.75 py-px align-middle font-mono text-12 leading-normal font-medium text-tx';
export const ISSUE_CHIP_SQUARE = 'size-2 rounded-tick bg-line';

/** The highlighter's token classes, coloured from the theme's status pairs. */
export const CODE_TOKENS = [
  '[&_.hljs-comment]:text-tx-3 [&_.hljs-comment]:italic [&_.hljs-quote]:text-tx-3',
  '[&_.hljs-keyword]:text-acc [&_.hljs-selector-tag]:text-acc [&_.hljs-literal]:text-acc',
  '[&_.hljs-string]:text-green-tx [&_.hljs-regexp]:text-green-tx [&_.hljs-addition]:text-green-tx',
  '[&_.hljs-number]:text-amber-tx [&_.hljs-deletion]:text-amber-tx',
  '[&_.hljs-title]:text-violet-fg [&_.hljs-section]:text-violet-fg',
  '[&_.hljs-type]:text-sky-fg [&_.hljs-built_in]:text-sky-fg',
  '[&_.hljs-attr]:text-amber-fg [&_.hljs-attribute]:text-amber-fg [&_.hljs-variable]:text-amber-fg',
  '[&_.hljs-meta]:text-pink-fg [&_.hljs-symbol]:text-pink-fg',
].join(' ');
