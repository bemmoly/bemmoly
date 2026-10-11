const BOOT_FRAME_ID = 'boot';

/** Read by public/boot-theme.js before the first paint. */
export const BOOT_LOOK_KEY = 'bemmoly.boot-look';

export interface BootLook {
  /** The preset id, or a custom theme's id. */
  theme: string;
  mode: 'light' | 'dark';
  /** A custom theme's custom properties; a preset needs none. */
  vars?: Record<string, string>;
}

/**
 * Remembers the look just applied, so the next load paints its boot frame in it rather than
 * in Classic light. Storage may be blocked; the boot frame then keeps the default look.
 */
export function rememberBootLook(look: BootLook): void {
  try {
    localStorage.setItem(BOOT_LOOK_KEY, JSON.stringify(look));
  } catch {
    // Private mode or storage full: nothing to remember.
  }
}

/**
 * Removes index.html's static first paint. It covers the page, so the router
 * renders underneath it and the swap is a single frame with no layout shift.
 */
export function releaseBootFrame(): void {
  document.getElementById(BOOT_FRAME_ID)?.remove();
}
