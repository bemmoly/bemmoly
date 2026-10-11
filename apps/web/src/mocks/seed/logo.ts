import type { MockDb } from '../db.ts';
import { storeMockLogo } from '../logo.ts';

/** Acme Labs' logo for the mock and the demo: a plain square SVG, as an upload would store it. */
const ACME_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="14" fill="#0f766e"/>' +
  '<path d="M18 46 32 16l14 30h-8l-6-14-6 14z" fill="#ffffff"/></svg>';

/** Gives the mock workspace Acme's logo; answers the logoKey it now holds. */
export function seedAcmeLogo(db: MockDb): string {
  return storeMockLogo(db, 'image/svg+xml', new TextEncoder().encode(ACME_SVG));
}
