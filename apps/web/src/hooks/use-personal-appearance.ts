import { queryKeys } from '@bemmoly/api-client';
import type { MeResponse, ModePreference, UpdateAppearancePreferenceInput } from '@bemmoly/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { useThemeStore } from '../store/theme.ts';

/**
 * Keeps the device cache in step with the account: /me wins, except once, when the account
 * has no choice yet and this device still holds one from before choices moved to the account.
 * That mode is written to the account so it follows the person to every device.
 */
export function useAppearanceSync(me: MeResponse): void {
  const queryClient = useQueryClient();
  const pushed = useRef(false);
  const account = me.preferences.appearance;
  useEffect(() => {
    const device = useThemeStore.getState();
    if (account.mode === null && device.mode !== null && !pushed.current) {
      pushed.current = true;
      void api.appearance
        .setPreference({ mode: device.mode })
        .then(() => queryClient.invalidateQueries({ queryKey: queryKeys.me() }))
        .catch(() => undefined);
      return;
    }
    // Only the mode is personal; the workspace admin sets the theme (ADR 0021).
    useThemeStore.getState().hydrate({ mode: account.mode, theme: null });
  }, [account, queryClient]);
}

/** Change this person's own mode: shown at once, then saved to their account. */
export function usePersonalAppearance() {
  const queryClient = useQueryClient();
  const mode = useThemeStore((state) => state.mode);
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
    setMode: (next: ModePreference | null) => {
      useThemeStore.getState().setMode(next);
      save.mutate({ mode: next });
    },
  };
}
