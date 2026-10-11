import { negotiateLocale, PSEUDO_LOCALE, SHIPPED_LOCALES, textDirection } from '@bemmoly/shared';

/** `?locale=en-XA` switches this device's language, for testing a screen in the pseudo-locale. */
export const LOCALE_PARAM = 'locale';

const DEVICE_KEY = 'bemmoly.locale';

export interface LocaleSources {
  /** The address's `?locale=`. */
  search?: string | null | undefined;
  /** The person's saved language; null means "Automatic". */
  person?: string | null | undefined;
  /** The last explicit choice on this device, for the pages before sign-in. */
  device?: string | null | undefined;
  /** navigator.languages. */
  browser?: readonly string[] | undefined;
}

/**
 * The language to show, in order: the address, the person's choice, this device's last
 * choice, the browser's languages, then English. Only shipped locales and the pseudo-locale
 * (asked for by name) can win.
 */
export function pickLocale(sources: LocaleSources): string {
  return negotiateLocale(
    [sources.search, sources.person, sources.device, ...(sources.browser ?? [])],
    [...SHIPPED_LOCALES, PSEUDO_LOCALE],
  );
}

export function readDeviceLocale(): string | null {
  try {
    return window.localStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

/** Remembers an explicit choice on this device; null forgets it and follows the browser. */
export function rememberDeviceLocale(locale: string | null): void {
  try {
    if (locale) window.localStorage.setItem(DEVICE_KEY, locale);
    else window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // Private windows may refuse storage; the person's saved choice still applies after sign-in.
  }
}

/** `<html lang dir>`: screen readers, hyphenation and logical properties follow it. */
export function applyDocumentLocale(locale: string): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = textDirection(locale);
}

/** A language named in its own words: "English", "Français", "Deutsch". */
export function languageName(locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}
