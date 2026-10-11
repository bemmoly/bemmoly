import { queryKeys } from '@bemmoly/api-client';
import { languageName, pickLocale, rememberDeviceLocale, useT } from '@bemmoly/core-web';
import { PSEUDO_LOCALE, SHIPPED_LOCALES, type MeResponse } from '@bemmoly/shared';
import type { SelectOption } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { settings } from '../i18n/settings.ts';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { showLocale } from '../lib/locale.ts';
import { toast } from '../lib/toast.ts';
import { useMe } from './use-session.ts';

/** The select's value for "no choice": follow the browser. */
export const AUTOMATIC = 'auto';

/**
 * The person's language, saved on their account so every device follows it (users.locale).
 * Automatic stores nothing and follows the browser. The change shows at once and is kept on
 * this device for the sign-in page; a failed save puts the old choice back.
 */
export function useLanguage() {
  const me = useMe();
  const t = useT(settings);
  const client = useQueryClient();
  const saved = me.user.locale;
  const mutation = useMutation({
    mutationFn: (locale: string | null) => api.users.update(me.user.id, { locale }),
    onMutate: (locale) => {
      const before = client.getQueryData<MeResponse>(queryKeys.me());
      if (before)
        client.setQueryData(queryKeys.me(), { ...before, user: { ...before.user, locale } });
      rememberDeviceLocale(locale);
      void showLocale(locale);
      return { before };
    },
    onError: (error, _locale, context) => {
      if (context?.before) client.setQueryData(queryKeys.me(), context.before);
      const previous = context?.before?.user.locale ?? null;
      rememberDeviceLocale(previous);
      void showLocale(previous);
      toast(describeError(error).message, 'danger');
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.me() }),
  });
  const automatic = pickLocale({ browser: navigator.languages });
  const offered = [...SHIPPED_LOCALES];
  // The pseudo-locale is for people building Bemmoly; it is listed in dev, or once chosen.
  if (import.meta.env.DEV || saved === PSEUDO_LOCALE) offered.push(PSEUDO_LOCALE);
  const options: SelectOption[] = [
    {
      value: AUTOMATIC,
      label: t('settings.profile.languageAuto', { language: languageName(automatic) }),
    },
    ...offered.map((locale) => ({
      value: locale,
      label: locale === PSEUDO_LOCALE ? t('settings.profile.languagePseudo') : languageName(locale),
    })),
  ];
  return {
    value: saved ?? AUTOMATIC,
    options,
    set: (value: string) => mutation.mutate(value === AUTOMATIC ? null : value),
    pending: mutation.isPending,
  };
}
