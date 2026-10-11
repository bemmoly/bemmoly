import type { MessageValues } from '@bemmoly/shared';
import { useSyncExternalStore, type ReactNode } from 'react';
import { richText, type RichTags } from './rich.tsx';
import { getLocale, onLocaleChange, translate, type Catalog } from './runtime.ts';

export interface Translate<Id extends string> {
  /** The message in the person's language: `t('shell.nav.home')`, `t('…count', { count })`. */
  (id: Id, values?: MessageValues): string;
  /**
   * A message with tags, each drawn by its function: "<link>Reset your password</link>" with
   * `{ link: (text) => <Link …>{text}</Link> }`. Values never become tags.
   */
  rich(id: Id, values: MessageValues | undefined, tags: RichTags): ReactNode;
}

let version = 0;
const listeners = new Set<() => void>();
onLocaleChange(() => {
  version += 1;
  for (const listener of listeners) listener();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const snapshot = () => version;

/**
 * The namespace's translate function, typed by its English catalog so an unknown id fails the
 * typecheck. The component re-renders when the language changes or a catalog finishes loading.
 */
export function useT<Id extends string>(_catalog: Catalog<Id>): Translate<Id> {
  return translatorFor(useSyncExternalStore(subscribe, snapshot, snapshot));
}

/** One function per catalog version, so `t` changes identity exactly when its output may. */
let cached: { version: number; t: Translate<string> } | null = null;

function translatorFor<Id extends string>(current: number): Translate<Id> {
  if (cached?.version !== current) {
    const t = Object.assign((id: string, values?: MessageValues) => translate(id, values), {
      rich: (id: string, values: MessageValues | undefined, tags: RichTags) =>
        richText((safe) => translate(id, safe), values, tags),
    });
    cached = { version: current, t };
  }
  return cached.t as Translate<Id>;
}

/** The active locale, for `lang` attributes and Intl calls of a component's own. */
export function useLocale(): string {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  return getLocale();
}
