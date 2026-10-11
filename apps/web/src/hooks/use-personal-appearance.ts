import { queryKeys } from '@bemmoly/api-client';
import type { MeResponse, ModePreference, UpdateAppearancePreferenceInput } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import type { ThemeRef } from '../lib/theme.ts';
import { toast } from '../lib/toast.ts';
import { useThemeStore } from '../store/theme.ts';

/**
 * Keeps the device cache in step with the account: /me wins, except once, when the account
 * has no choice yet and this device still holds one from before choices moved to the account.
 * That one is written to the account so it follows the person to every device.
 */
export function useAppearanceSync(me: MeResponse): void {
  const queryClient = useQueryClient();
  const pushed = useRef(false);
  const account = me.preferences.appearance;
  useEffect(() => {
    const device = useThemeStore.getState();
    const accountEmpty = account.mode === null && account.theme === null;
    const deviceHas = device.mode !== null || device.theme !== null;
    if (accountEmpty && deviceHas && !pushed.current) {
      pushed.current = true;
      const allowed = me.workspace.appearance.personalThemes;
      const body: UpdateAppearancePreferenceInput = {
        mode: device.mode,
        ...(allowed ? { theme: device.theme } : {}),
      };
      void api.appearance
        .setPreference(body)
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.me() }))
        .catch(() => undefined);
      return;
    }
    useThemeStore.getState().hydrate(account);
  }, [account, me.workspace.appearance.personalThemes, queryClient]);
}

/** Change this person's own mode or theme: shown at once, then saved to their account. */
export function usePersonalAppearance() {
  const queryClient = useQueryClient();
  const mode = useThemeStore((state) => state.mode);
  const theme = useThemeStore((state) => state.theme);
  const save = useMutation({
    mutationFn: (body: UpdateAppearancePreferenceInput) => api.appearance.setPreference(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
    onError: (error) => {
      toast(describeError(error).message, 'danger');
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() });
    },
  });
  return {
    mode,
    theme,
    setMode: (next: ModePreference | null) => {
      useThemeStore.getState().setMode(next);
      save.mutate({ mode: next });
    },
    setTheme: (next: ThemeRef | null) => {
      useThemeStore.getState().setTheme(next);
      save.mutate({ theme: next });
    },
  };
}
