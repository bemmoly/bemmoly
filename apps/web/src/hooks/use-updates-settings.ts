import { queryKeys } from '@bemmoly/api-client';
import type { ReleaseChannel, UpdatesOverview } from '@bemmoly/shared';
import { useQueryClient } from '@tanstack/react-query';
import type { ChangeConfirm } from '../components/settings/use-confirm-change.ts';
import { useDraft, useSettings } from './use-setting.ts';

const KEYS = ['system.updates.channel', 'system.updates.check'] as const;

export interface UpdatePolicy {
  channel: ReleaseChannel;
  checkDaily: boolean;
}

/** Switching channel changes which releases this server is offered, so it asks first. */
export function channelRisk(stored: UpdatePolicy, next: UpdatePolicy): ChangeConfirm | null {
  if (stored.channel === next.channel) return null;
  const toBeta = next.channel === 'beta';
  return {
    title: toBeta ? 'Switch to the beta channel?' : 'Switch to the stable channel?',
    consequences: toBeta
      ? [
          'This server is offered beta releases: new features earlier, before they are tested as widely as stable ones.',
          'A beta release can have bugs that stop people working until it is fixed or rolled back.',
          'Nothing installs until you choose Update; a backup is taken first, as for every update.',
        ]
      : [
          'This server is offered stable releases only from now on.',
          'If a beta version is running, it stays until you install a stable release.',
          'Nothing installs until you choose Update.',
        ],
    confirmLabel: toBeta ? 'Switch to beta' : 'Switch to stable',
    tone: 'caution',
  };
}

/** Settings › Updates: the channel and the daily release check, edited as one section. */
export function useUpdateSettings(overview: UpdatesOverview | undefined) {
  const queryClient = useQueryClient();
  const settings = useSettings(KEYS, 'Update settings saved');
  const reads = settings.reads;
  const stored: UpdatePolicy | undefined =
    reads || overview
      ? {
          channel: reads?.['system.updates.channel'].value ?? overview?.current.channel ?? 'stable',
          checkDaily: reads?.['system.updates.check'].value ?? overview?.checks.enabled ?? true,
        }
      : undefined;
  const draft = useDraft(stored);

  const save = (onSaved: () => void) => {
    if (!draft.value) return;
    settings.save.mutate(
      {
        'system.updates.channel': draft.value.channel,
        'system.updates.check': draft.value.checkDaily,
      },
      {
        onSuccess: () => {
          draft.discard();
          onSaved();
          void queryClient.invalidateQueries({ queryKey: queryKeys.updates() });
        },
      },
    );
  };

  return {
    stored,
    value: draft.value,
    dirty: draft.dirty,
    update: draft.update,
    discard: draft.discard,
    save,
    saving: settings.save.isPending,
  };
}
