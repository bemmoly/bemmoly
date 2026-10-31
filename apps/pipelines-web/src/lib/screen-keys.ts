/*
 * Which keys belong to the focused element rather than to the screen. Text fields, selects
 * and editors own every key (typingInField already skips them); a focused button, link,
 * summary or other control owns Enter and Space, which press it, so a screen's Enter never
 * swallows the press.
 */

const CONTROL =
  'button, a[href], [role="button"], [role="link"], [role="radio"], [role="checkbox"], [role="tab"], [role="switch"], [role="menuitem"], select, summary, input, textarea, [contenteditable]:not([contenteditable="false"])';

const ACTIVATION_KEYS = new Set(['enter', ' ']);

/** Whether `key` (lowercased, as KeyboardEvent.key) should be left to the focused element. */
export function focusOwnsKey(target: EventTarget | null, key: string): boolean {
  if (!ACTIVATION_KEYS.has(key.toLowerCase())) return false;
  const element = target as Element | null;
  if (!element || typeof element.closest !== 'function') return false;
  return element.closest(CONTROL) !== null;
}
