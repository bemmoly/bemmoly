/**
 * The bundled sign-in marks (assets/sso-logos, one file per preset `logo`). Only their URLs are
 * in the script: each file is emitted on its own and fetched when a card or button shows it.
 */
const FILES = import.meta.glob<string>('../assets/sso-logos/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
});

const BY_NAME = new Map(
  Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/|\.svg$/g, ''), url]),
);

/** The mark's URL, or null when none is bundled (the key glyph is shown instead). */
export function ssoLogoUrl(name: string | null): string | null {
  return name ? (BY_NAME.get(name) ?? null) : null;
}
