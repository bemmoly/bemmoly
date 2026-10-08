/**
 * The bundled provider logos (assets/provider-logos, one file per catalog id). Only their URLs
 * are in the script: each file is emitted on its own and fetched when a card or row shows it.
 */
const FILES = import.meta.glob<string>('../assets/provider-logos/*.svg', {
  eager: true,
  query: '?no-inline',
  import: 'default',
});

const BY_ID = new Map(
  Object.entries(FILES).map(([path, url]) => [path.replace(/^.*\/|\.svg$/g, ''), url]),
);

/** The logo for a catalog id, or null when none is bundled (initials are shown instead). */
export function providerLogoUrl(id: string): string | null {
  return BY_ID.get(id) ?? null;
}

/** Every catalog id that has a bundled logo. */
export function providerLogoIds(): string[] {
  return [...BY_ID.keys()];
}
