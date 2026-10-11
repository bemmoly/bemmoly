import {
  negotiateLocale,
  SHIPPED_LOCALES,
  SOURCE_LOCALE,
  type MessageValues,
} from '@bemmoly/shared';
import { setupI18n, type I18n, type Messages } from '@lingui/core';
import { compileMessage } from '@lingui/message-utils/compileMessage';
import email from './email.en.json' with { type: 'json' };

/*
 * Text the server writes for people (ADR 0025): emails now, digests and notifications as they
 * move over. Same ICU messages and catalog layout as the web, compiled once per locale at
 * first use, since the server has no build step (ADR 0003). Errors are not translated here;
 * they carry a messageId and the client shows them in the reader's language.
 */

const SOURCE: Messages = { ...email };

/** Translated catalogs by locale, added beside the source as `email.<locale>.json`. */
const TRANSLATED: Readonly<Record<string, Messages>> = {};

export type ServerMessageId = keyof typeof email;

export type ServerText = (id: ServerMessageId, values?: MessageValues) => string;

const instances = new Map<string, I18n>();

function instanceFor(locale: string): I18n {
  let i18n = instances.get(locale);
  if (!i18n) {
    i18n = setupI18n();
    i18n.setMessagesCompiler(compileMessage);
    i18n.load(locale, { ...SOURCE, ...TRANSLATED[locale] });
    i18n.activate(locale);
    instances.set(locale, i18n);
  }
  return i18n;
}

/** The shipped locale nearest to the one asked for: the recipient's, then the workspace's. */
export function serverLocale(...preferred: (string | null | undefined)[]): string {
  return negotiateLocale([...preferred, SOURCE_LOCALE], SHIPPED_LOCALES);
}

/** Messages in one locale; an id with no translation reads in English. */
export function serverText(locale: string = SOURCE_LOCALE): ServerText {
  const i18n = instanceFor(serverLocale(locale));
  return (id, values) => i18n._(id, values);
}
