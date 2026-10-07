import type { DigestSettings } from '@bemmoly/shared';
import { useState } from 'react';
import { BUTTON } from '../../components/button-sizes.ts';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { useNotificationPreferences } from '../../hooks/use-notifications.ts';
import {
  Button,
  Card,
  CardHeader,
  CardRow,
  CardRows,
  SegmentedControl,
  Select,
  toast,
} from '../../ui.ts';

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
  const currentDigest = digest ?? data?.digest;
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
      subtitle="How Bemmoly tells you about mentions, reviews and changes. Everything lands in your inbox unless you turn it off."
      loading={isPending}
      error={error}
      actions={
        <Button
          variant="primary"
          className={BUTTON.primary}
          disabled={!dirty || save.isPending}
          onClick={submit}
        >
          Save
        </Button>
      }
    >
      <CardRows>
        {rows.map((row, index) => {
          const channel = kinds[row.kind] ?? row.channel;
          const known = CHANNELS.some((option) => option.value === channel);
          return (
            <CardRow
              key={row.kind}
              label={labelOf(row.kind)}
              hint={
                channel === row.defaultChannel
                  ? KINDS[row.kind]?.hint
                  : 'Changed from the workspace default.'
              }
              last={index === rows.length - 1}
              control={
                <Select
                  aria-label={`${labelOf(row.kind)} delivery`}
                  className="w-64"
                  options={known ? CHANNELS : [...CHANNELS, { value: channel, label: channel }]}
                  value={channel}
                  onChange={(event) => setKinds({ ...kinds, [row.kind]: event.target.value })}
                />
              }
            />
          );
        })}
      </CardRows>
      {currentDigest ? (
        <Card>
          <CardHeader>Email digest</CardHeader>
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="w-72">
              <SegmentedControl
                label="Digest cadence"
                value={currentDigest.cadence}
                onChange={(cadence) => setDigest({ ...currentDigest, cadence })}
                options={[
                  { value: 'interval', label: 'Every few minutes' },
                  { value: 'daily', label: 'Once a day' },
                ]}
              />
            </div>
            {currentDigest.cadence === 'daily' ? (
              <Select
                aria-label="Daily digest hour"
                options={HOURS}
                value={String(currentDigest.dailyHour)}
                onChange={(event) =>
                  setDigest({ ...currentDigest, dailyHour: Number(event.target.value) })
                }
              />
            ) : null}
            <span className="ml-auto text-caption text-tx5">Times in {currentDigest.timeZone}</span>
          </div>
        </Card>
      ) : null}
    </SettingsPage>
  );
}
