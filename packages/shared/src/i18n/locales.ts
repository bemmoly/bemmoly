/**
 * Which languages Bemmoly speaks (ADR 0024). English is the source: every message is written in
 * English first and every other catalog is a translation of it. A locale ships when its catalogs
 * are complete; only shipped locales are offered to people.
 */
export const SOURCE_LOCALE = 'en';

/**
 * Accented, padded English for testing layout and truncation, never offered as a language.
 * en-XA is the tag the platforms reserve for it.
 */
export const PSEUDO_LOCALE = 'en-XA';

export const SHIPPED_LOCALES: readonly string[] = [SOURCE_LOCALE];

/** Languages written right to left, by their primary subtag. */
const RTL_LANGUAGES = new Set(['ar', 'ckb', 'dv', 'fa', 'he', 'ks', 'ps', 'sd', 'ug', 'ur', 'yi']);

/** "EN-us" → "en-US"; null for anything that is not a language tag. */
export function canonicalLocale(tag: string): string | null {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? null;
  } catch {
    return null;
  }
}

function languageOf(tag: string): string {
  return tag.split('-')[0]?.toLowerCase() ?? tag.toLowerCase();
}

/**
 * The first requested locale that is available, in the order asked: an exact match, then the
 * same language ("pt-BR" finds "pt", "fr" finds "fr-CA"). The pseudo-locale only matches
 * exactly. Nothing usable falls back to the first available locale.
 */
export function negotiateLocale(
  requested: Iterable<string | null | undefined>,
  available: readonly string[] = SHIPPED_LOCALES,
): string {
  const exact = new Map(available.map((tag) => [tag.toLowerCase(), tag]));
  const real = available.filter((tag) => tag !== PSEUDO_LOCALE);
  for (const raw of requested) {
    const tag = raw ? canonicalLocale(raw) : null;
    if (!tag) continue;
    const found = exact.get(tag.toLowerCase());
    if (found) return found;
    const language = languageOf(tag);
    const loose =
      real.find((candidate) => candidate.toLowerCase() === language) ??
      real.find((candidate) => languageOf(candidate) === language);
    if (loose) return loose;
  }
  return available[0] ?? SOURCE_LOCALE;
}

/** The writing direction of a locale, for `<html dir>`. */
export function textDirection(locale: string): 'ltr' | 'rtl' {
  return RTL_LANGUAGES.has(languageOf(locale)) ? 'rtl' : 'ltr';
}
