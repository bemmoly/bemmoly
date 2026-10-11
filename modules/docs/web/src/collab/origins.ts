/*
 * Yjs transaction origins for changes the tab makes itself rather than the person typing:
 * local mode reads them so it writes back only what was typed.
 */

/** The stored snapshot that starts a local document. */
export const FROM_SEED = Symbol('docs.local-seed');

/** A stored body that changed elsewhere (a restore, an applied fix) replacing the tab's. */
export const FROM_STORE = Symbol('docs.local-store');
