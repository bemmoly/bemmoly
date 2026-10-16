import { shortHash } from './hash.ts';

/*
 * Account names the strictest cloud accepts: Google project ids are 6 to 30 characters of
 * lowercase letters, digits and dashes, start with a letter and are unique across all of
 * Google Cloud. A suffix from the connection keeps two installs from colliding; names too
 * long are cut and given a hash of the full name, so they stay distinct.
 */

const MAX = 30;

export const slugPart = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "acme" from "Acme Google Cloud": the first word of the connection's name. */
export function prefixOf(connectionName: string, configured: unknown): string {
  const chosen =
    typeof configured === 'string' && configured ? configured : connectionName.split(/\s+/)[0];
  const slug = slugPart(chosen ?? '')
    .slice(0, 12)
    .replace(/-+$/, '');
  return /^[a-z]/.test(slug) ? slug : `b${slug}`.slice(0, 12);
}

export function accountIdOf(prefix: string, parts: readonly string[], suffix: string): string {
  const base = [prefix, ...parts.map(slugPart)].filter(Boolean).join('-');
  const room = MAX - suffix.length - 1;
  const fitted =
    base.length <= room ? base : `${base.slice(0, room - 5).replace(/-+$/, '')}-${shortHash(base)}`;
  return `${fitted}-${suffix}`;
}
