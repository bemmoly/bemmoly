/**
 * Interaction timing and the focus ring, shared by every primitive (ADR 0015 and
 * docs/design/premium/interaction.md, "Foundations").
 */

/** The keyboard focus ring: a 2px accent outline, offset 2px, on :focus-visible only. */
export const FOCUS = {
  'focus-width': '2px',
  'focus-offset': '2px',
} as const;

export const TIMING = {
  /** Hover before a tooltip opens. */
  tooltipDelayMs: 400,
  /** After one tooltip closes, the next opens at once if the pointer arrives within this. */
  tooltipSkipMs: 300,
  /** How long a toast stays, and how long Undo is offered; paused while hovered or focused. */
  toastMs: 6000,
} as const;
