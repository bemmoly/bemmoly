import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { showLocale } from '../lib/locale.ts';
import { meQuery } from './use-session.ts';

/**
 * Follows the person's saved language once /me is in the cache; before sign-in the device and
 * the browser decide (lib/locale.ts). Reads the cache only, like the theme, so it never fetches.
 */
export function useLocaleEffect(): void {
  const { data: me } = useQuery({ ...meQuery, enabled: false });
  const person = me?.user.locale ?? null;
  useEffect(() => {
    void showLocale(person);
  }, [person]);
}
