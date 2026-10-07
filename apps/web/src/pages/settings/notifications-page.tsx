import type { DigestSettings } from '@bemmoly/shared';
import { Button, SegmentedControl, Select, SettingsRow, SettingsSection } from '@bemmoly/ui';
import { useState } from 'react';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useNotificationPreferences } from '../../hooks/use-notifications.ts';
import { toast } from '../../lib/toast.ts';

const CHANNELS = [
  { value: 'email_immediate', label: 'Inbox and email right away' },
  { value: 'email_digest', label: 'Inbox and the email digest' },
  { value: 'in_app', label: 'Inbox only' },
  { value: 'off', label: 'Off' },
];

const KINDS: Record<string, { label: string; hint?: string }> = {
  mention: { label: 'Mentions', hint: 'Someone @-mentions you in an issue, page or comment.' },
  assignment: { label: 'Assignments', hint: 'You are assigned an issue.' },
  review_request: { label: 'Review requests' },
  comment: { label: 'Comments on things you watch' },
  status_change: { label: 'Status changes on things you watch' },
  system: { label: 'Workspace notices', hint: 'Updates, backups and security notices.' },
};

const labelOf = (kind: string) =>
  KINDS[kind]?.label ?? kind.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase());

const HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

export function NotificationPreferencesPage() {
  const { data, isPending, error, save } = useNotificationPreferences();
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [digest, setDigest] = useState<DigestSettings | null>(null);
  const rows = data?.kinds ?? [];
  const current = digest ?? data?.digest;
  const dirty = Object.keys(kinds).length > 0 || digest !== null;
  const submit = () =>
    save.mutate(
      { ...(Object.keys(kinds).length ? { kinds } : {}), ...(digest ? { digest } : {}) },
      {
        onSuccess: () => {
          setKinds({});
          setDigest(null);
          toast('Notification preferences saved');
        },
      },
    );
  return (
    <SettingsPage
      title="Notifications"
      description="How Bemmoly tells you about mentions, reviews and changes. Everything lands in your inbox unless you turn it off."
      loading={isPending}
      error={error}
      actions={
        <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={submit}>
          Save
        </Button>
      }
    >
      <SettingsSection title="Delivery">
        {rows.map((row) => {
          const channel = kinds[row.kind] ?? row.channel;
          const known = CHANNELS.some((option) => option.value === channel);
          return (
            <SettingsRow
              key={row.kind}
              title={labelOf(row.kind)}
              description={
                channel === row.defaultChannel ? KINDS[row.kind]?.hint : 'Changed from the default.'
              }
              control={
                <Select
                  aria-label={`${labelOf(row.kind)} delivery`}
                  wrapperClassName="w-64"
                  options={known ? CHANNELS : [...CHANNELS, { value: channel, label: channel }]}
                  value={channel}
                  onChange={(event) => setKinds({ ...kinds, [row.kind]: event.target.value })}
                />
              }
            />
          );
        })}
      </SettingsSection>
      {current ? (
        <SettingsSection title="Email digest" hint={`Times in ${current.timeZone}`}>
          <SettingsRow
            title="How often"
            description="Mentions, assignments and review requests always go right away."
            control={
              <div className="flex items-center gap-3">
                <SegmentedControl
                  value={current.cadence}
                  onChange={(cadence) => setDigest({ ...current, cadence })}
                  options={[
                    { value: 'interval', label: 'Every few minutes' },
                    { value: 'daily', label: 'Once a day' },
                  ]}
                />
                {current.cadence === 'daily' ? (
                  <Select
                    aria-label="Daily digest hour"
                    options={HOURS}
                    value={String(current.dailyHour)}
                    onChange={(event) =>
                      setDigest({ ...current, dailyHour: Number(event.target.value) })
                    }
                  />
                ) : null}
              </div>
            }
          />
        </SettingsSection>
      ) : null}
    </SettingsPage>
  );
}
