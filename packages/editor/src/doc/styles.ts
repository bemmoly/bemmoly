import type { CalloutVariant, DecisionState } from '../schema/nodes/values.ts';

/*
 * The class lists of the Docs nodes, shared by the editor's node views and the read-only
 * view so a page looks the same before and after Edit. Measures are the Doc Editor mock's:
 * the TL;DR box (8px radius, 12px 16px, 13.5px at 1.55, a 7px dot and a 12.5px label), the
 * inline issue chip, and the 320px menu's type. Colours are tokens only.
 */

export const CALLOUT_BOX: Record<CalloutVariant, string> = {
  info: 'border-ac-br2 bg-ac-bg2',
  note: 'border-br bg-bg2',
  success: 'border-ok-bg bg-ok-bg',
  warning: 'border-amber-bg bg-amber-bg',
  danger: 'border-warn-bg bg-warn-bg',
};

/** The dot and label colour of each variant. */
export const CALLOUT_INK: Record<CalloutVariant, { dot: string; label: string }> = {
  info: { dot: 'bg-ac', label: 'text-ac' },
  note: { dot: 'bg-tx5', label: 'text-tx4' },
  success: { dot: 'bg-ok', label: 'text-ok-fg' },
  warning: { dot: 'bg-caution', label: 'text-amber-fg' },
  danger: { dot: 'bg-warn', label: 'text-warn-fg' },
};

export const calloutClass = (variant: CalloutVariant) =>
  `flex flex-col gap-1.5 rounded-card border px-4 py-3 text-13h leading-brief ${CALLOUT_BOX[variant]}`;

/** The header row of a callout or decision: dot, label, and anything at the right. */
export const NODE_HEADER =
  'flex items-center gap-1.75 text-12h font-semibold select-none [&>[data-dot]]:size-1.75 [&>[data-dot]]:shrink-0 [&>[data-dot]]:rounded-full';

/** The blocks inside a callout or decision. */
export const NODE_BODY = 'flex min-w-0 flex-col gap-1.5 [&_p]:m-0';

export const DECISION_BOX =
  'flex flex-col gap-1.5 rounded-card border border-br border-l-3 bg-sf px-4 py-3 text-14 leading-body';

export const DECISION_INK: Record<DecisionState, { border: string; pill: string }> = {
  proposed: { border: 'border-l-caution', pill: 'bg-amber-bg text-amber-fg' },
  decided: { border: 'border-l-ok', pill: 'bg-ok-bg text-ok-fg' },
  superseded: { border: 'border-l-br3', pill: 'bg-chip text-tx4' },
};

export const STATE_PILL =
  'rounded-chip px-1.5 py-px text-10 font-semibold tracking-status uppercase';

export const TOC_BOX =
  'flex flex-col gap-0.5 border-l-2 border-br2 py-0.5 pl-3 text-13h leading-body';
/** Indent by depth below the outline's top level. */
export const TOC_INDENT: Record<number, string> = { 1: '', 2: 'pl-4', 3: 'pl-8' };
export const TOC_LINK = 'truncate text-tx3 no-underline hover:text-ac';

/** A table that scrolls sideways inside the page's measure rather than widening it. */
export const TABLE_WRAP = 'min-w-0 overflow-x-auto';
export const TABLE =
  'w-full border-collapse text-13h leading-body [&_td]:border [&_td]:border-br [&_td]:px-2.5 [&_td]:py-1.5 [&_td]:align-top [&_th]:border [&_th]:border-br [&_th]:bg-sf2 [&_th]:px-2.5 [&_th]:py-1.5 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:text-tx [&_p]:m-0 [&_.selectedCell]:bg-ac-bg';

export const IMAGE_FRAME = 'flex flex-col items-start gap-1.5';
export const IMAGE = 'max-w-full rounded-card border border-br';
export const IMAGE_CAPTION = 'text-12h text-tx5';

/** The quiet dashed card a node shows when its live content cannot be drawn. */
export const PLACEHOLDER_CARD =
  'flex flex-col gap-1 rounded-card border border-dashed border-br3 bg-bg2 px-4 py-3 text-13 leading-body text-tx4';
export const PLACEHOLDER_TITLE = 'text-12h font-semibold text-tx3';

export const PAGE_LINK = 'font-medium text-ac no-underline hover:text-ac-d cursor-pointer';

/** The mock's inline issue chip (KeyChip inline), with a neutral square when nothing is live. */
export const ISSUE_CHIP =
  'inline-flex items-center gap-1.25 rounded-xs border border-br3 bg-sf px-1.75 py-px align-middle font-mono text-12 leading-normal font-medium text-tx';
export const ISSUE_CHIP_SQUARE = 'size-2 rounded-tick bg-br3';

/** The highlighter's token classes, coloured from the theme's status pairs. */
export const CODE_TOKENS = [
  '[&_.hljs-comment]:text-tx5 [&_.hljs-comment]:italic [&_.hljs-quote]:text-tx5',
  '[&_.hljs-keyword]:text-ac [&_.hljs-selector-tag]:text-ac [&_.hljs-literal]:text-ac',
  '[&_.hljs-string]:text-ok-fg [&_.hljs-regexp]:text-ok-fg [&_.hljs-addition]:text-ok-fg',
  '[&_.hljs-number]:text-warn-fg [&_.hljs-deletion]:text-warn-fg',
  '[&_.hljs-title]:text-violet-fg [&_.hljs-section]:text-violet-fg',
  '[&_.hljs-type]:text-sky-fg [&_.hljs-built_in]:text-sky-fg',
  '[&_.hljs-attr]:text-amber-fg [&_.hljs-attribute]:text-amber-fg [&_.hljs-variable]:text-amber-fg',
  '[&_.hljs-meta]:text-pink-fg [&_.hljs-symbol]:text-pink-fg',
].join(' ');
