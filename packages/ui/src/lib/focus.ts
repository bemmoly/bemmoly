/**
 * The keyboard focus ring every interactive component carries: the `focus-ring` utility
 * generated from the FOCUS tokens, a 2px accent outline offset 2px, on :focus-visible only, so
 * a pointer click never shows it and the keyboard always does.
 */
export const focusRing = 'focus-ring';

/** For rows and items inside a clipped container, where an outer offset would be cut off. */
export const focusRingInset = 'focus-ring-inset';

/**
 * The caret of a control that opens a list: muted at rest, the text colour while the list is
 * open or the control has keyboard focus. The control carries `group`.
 */
export const caretTone =
  'shrink-0 text-tx-3 group-aria-expanded:text-tx group-focus-visible:text-tx';
