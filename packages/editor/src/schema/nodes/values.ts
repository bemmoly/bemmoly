/*
 * The values the Docs nodes take, apart from their Tiptap definitions so the read-only view,
 * which never loads ProseMirror, can draw them too.
 */

export const CALLOUT_VARIANTS = ['info', 'note', 'success', 'warning', 'danger'] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const isCalloutVariant = (value: unknown): value is CalloutVariant =>
  CALLOUT_VARIANTS.includes(value as CalloutVariant);

/** The label a callout prints in Markdown and reads out to assistive technology. */
export const CALLOUT_LABELS: Record<CalloutVariant, string> = {
  info: 'Info',
  note: 'Note',
  success: 'Success',
  warning: 'Warning',
  danger: 'Danger',
};

export const DECISION_STATES = ['proposed', 'decided', 'superseded'] as const;
export type DecisionState = (typeof DECISION_STATES)[number];

export const isDecisionState = (value: unknown): value is DecisionState =>
  DECISION_STATES.includes(value as DecisionState);

export const DECISION_LABELS: Record<DecisionState, string> = {
  proposed: 'Proposed',
  decided: 'Decided',
  superseded: 'Superseded',
};

/** "Decided · 2026-10-07", the line a decision prints above its text. */
export function decisionHeading(state: string, decidedOn: string): string {
  const label = DECISION_LABELS[isDecisionState(state) ? state : 'proposed'];
  return decidedOn ? `${label} · ${decidedOn}` : label;
}

/** Sources an image may load from: the web and paths inside the app. */
export const SAFE_IMAGE_SRC = /^(https?:\/\/|\/(?!\/))/i;

const SOURCES: Record<string, string> = { confluence: 'Confluence', markdown: 'Markdown' };

/** "Confluence macro: jira-chart", the label an unsupported block shows and exports print. */
export function unsupportedLabel(source: string, name: string): string {
  const from = SOURCES[source] ?? (source || 'Imported');
  return `${from} ${source === 'confluence' ? 'macro' : 'block'}: ${name || 'unknown'}`;
}
