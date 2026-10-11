import { PSEUDO_LOCALE, SOURCE_LOCALE, type MessageValues } from '@bemmoly/shared';
import { setFormatLocale } from '@bemmoly/ui/intl';
import { setupI18n, type Messages } from '@lingui/core';

/*
 * The one i18n runtime (ADR 0024): Lingui's core, fed catalogs compiled at build time. Every
 * owner of UI text (the shell, the kernel UI, each module) defines its own namespace with its
 * English source imported statically, so the text arrives with the code that draws it, and
 * every other locale as a lazy chunk fetched only when a person picks that language. The kernel
 * never imports a module's catalog; a module's chunk defines it when it loads.
 */

export type CatalogLoader = () => Promise<{ default: Messages }>;

export interface Catalog<Id extends string = string> {
  readonly namespace: string;
  /** Translates outside React (a toast, a hook's message); components use `useT`. */
  t(id: Id, values?: MessageValues): string;
}

interface Entry {
  source: Messages;
  locales: Readonly<Record<string, CatalogLoader>>;
}

const i18n = setupI18n({ locale: SOURCE_LOCALE, messages: { [SOURCE_LOCALE]: {} } });
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<void>>();
let wanted = SOURCE_LOCALE;

/** Plain text needs no compiling; anything with ICU syntax arrives compiled from the build. */
const SYNTAX = /[{}'<]/;

function normalise(source: Record<string, unknown>): Messages {
  const out: Messages = {};
  for (const [id, message] of Object.entries(source)) {
    out[id] = (
      typeof message === 'string' && !SYNTAX.test(message) ? [message] : message
    ) as Messages[string];
  }
  return out;
}

/** Loads one namespace into a locale: English first, so a missing translation still reads. */
function loadInto(locale: string, namespace: string, entry: Entry): Promise<void> {
  if (locale === SOURCE_LOCALE) return Promise.resolve();
  const key = `${locale}|${namespace}`;
  let loading = pending.get(key);
  if (!loading) {
    // Copies: Lingui keeps the first object it is given per locale and merges into it.
    i18n.load(locale, { ...entry.source });
    const loader = entry.locales[locale];
    loading =
      locale === PSEUDO_LOCALE
        ? import('./pseudo.ts').then(({ pseudoMessages }) =>
            i18n.load(locale, pseudoMessages(entry.source)),
          )
        : loader
          ? loader().then((module) => i18n.load(locale, normalise(module.default)))
          : Promise.resolve();
    loading = loading.catch(() => {
      // A chunk that failed to load keeps English; the next language change tries again.
      pending.delete(key);
    });
    pending.set(key, loading);
  }
  return loading;
}

export function translate(id: string, values?: MessageValues): string {
  return i18n._(id, values);
}

/**
 * Defines a namespace: every id in `source` starts with `<namespace>.` (the catalog check
 * enforces it), and `locales` maps each translated locale to its lazy catalog.
 */
export function defineCatalog<Source extends Record<string, unknown>>(
  namespace: string,
  source: Source,
  locales: Readonly<Record<string, CatalogLoader>> = {},
): Catalog<Extract<keyof Source, string>> {
  if (!entries.has(namespace)) {
    const entry = { source: normalise(source), locales };
    entries.set(namespace, entry);
    i18n.load(SOURCE_LOCALE, { ...entry.source });
    if (i18n.locale !== SOURCE_LOCALE) void loadInto(i18n.locale, namespace, entry);
  }
  return { namespace, t: translate };
}

export function getLocale(): string {
  return i18n.locale;
}

/**
 * Switches every namespace to `locale`, fetching what it needs first so the switch is one
 * paint. A later call wins over an earlier one still loading.
 */
export async function setLocale(locale: string): Promise<void> {
  wanted = locale;
  await Promise.all([...entries].map(([namespace, entry]) => loadInto(locale, namespace, entry)));
  if (wanted !== locale || i18n.locale === locale) return;
  i18n.activate(locale);
  setFormatLocale(locale);
}

/** Every change of locale or newly loaded catalog; returns the unsubscribe. */
export function onLocaleChange(listener: () => void): () => void {
  return i18n.on('change', listener);
}
