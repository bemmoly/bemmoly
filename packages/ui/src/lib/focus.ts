/**
 * The keyboard focus ring every interactive component carries. The mocks show no focus
 * state, so this is the one addition: a 2px accent outline, offset so it never covers a
 * border, visible for keyboard focus only.
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ac';

/** For rows and items inside a clipped container, where an outer offset would be cut off. */
export const focusRingInset =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ac';

/**
 * The caret of a control that opens a list: tx4 at rest, the text colour while the list is
 * open or the control has keyboard focus. The control carries `group`.
 */
export const caretTone =
  'shrink-0 text-tx4 group-aria-expanded:text-tx group-focus-visible:text-tx';
