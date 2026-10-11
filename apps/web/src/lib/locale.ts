import {
  applyDocumentLocale,
  LOCALE_PARAM,
  pickLocale,
  readDeviceLocale,
  rememberDeviceLocale,
  setLocale,
} from '@bemmoly/core-web';
import '../i18n/catalogs.ts';

/** Switches the page's language: `<html lang dir>` at once, the text once its catalogs load. */
export async function showLocale(person: string | null | undefined): Promise<void> {
  const locale = pickLocale({
    person,
    device: readDeviceLocale(),
    browser: typeof navigator === 'undefined' ? [] : navigator.languages,
  });
  applyDocumentLocale(locale);
  await setLocale(locale);
}

/**
 * Before the first paint: `?locale=` becomes this device's choice (how the pseudo-locale is
 * turned on for a test), then the device and browser decide until the person is known.
 */
export async function startLocale(): Promise<void> {
  const asked = new URLSearchParams(window.location.search).get(LOCALE_PARAM);
  if (asked) rememberDeviceLocale(asked);
  await showLocale(null);
}
