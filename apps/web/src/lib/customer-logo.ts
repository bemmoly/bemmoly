import type { CustomerLogo } from '@bemmoly/ui';

/**
 * The workspace's own logo, when its stored key names an image the page may load: one served by
 * this install (an app-relative path) or an inline image. The content security policy allows
 * nothing else, so any other key draws the Bemmoly lockup alone rather than a broken image.
 */
export function customerLogo(
  name: string,
  logoKey: string | null | undefined,
): CustomerLogo | null {
  const key = logoKey?.trim() ?? '';
  const servedHere = key.startsWith('/') && !key.startsWith('//');
  const inline = /^data:image\/(png|jpeg|webp|svg\+xml);/.test(key);
  return servedHere || inline ? { name, src: key } : null;
}
