const BOOT_FRAME_ID = 'boot';

/**
 * Removes index.html's static first paint. It covers the page, so the router
 * renders underneath it and the swap is a single frame with no layout shift.
 */
export function releaseBootFrame(): void {
  document.getElementById(BOOT_FRAME_ID)?.remove();
}
