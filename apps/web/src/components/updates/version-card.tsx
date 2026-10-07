import { formatRelative } from '@bemmoly/core-web';
import type { UpdateChannel, UpdateStatus } from '@bemmoly/shared';
import { Button, Select, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';

const CHANNELS = [
  { value: 'stable', label: 'Stable' },
  { value: 'beta', label: 'Beta' },
];

interface VersionCardProps {
  status: UpdateStatus;
  channel: UpdateChannel;
  checkDaily: boolean;
  saving: boolean;
  checking: boolean;
  onChannel: (channel: UpdateChannel) => void;
  onCheckDaily: (on: boolean) => void;
  onCheck: () => void;
}

export function VersionCard({
  status,
  channel,
  checkDaily,
  saving,
  checking,
  onChannel,
  onCheckDaily,
  onCheck,
}: VersionCardProps) {
  return (
    <SettingsSection title="This server" layout="rows">
      <SettingsRow
        title={
          <>
            Running <span className="font-mono text-12h">{status.currentVersion}</span>
          </>
        }
        description={
          status.lastCheckedAt
            ? `Last checked ${formatRelative(status.lastCheckedAt)}`
            : 'Not checked yet'
        }
        control={
          <Button size="sm" loading={checking} onClick={onCheck}>
            Check for updates
          </Button>
        }
      />
      <SettingsRow
        title="Channel"
        description="Beta gets releases earlier, before they reach stable."
        control={
          <Select
            aria-label="Update channel"
            wrapperClassName="w-40"
            options={CHANNELS}
            value={channel}
            disabled={saving}
            onChange={(event) => onChannel(event.target.value as UpdateChannel)}
          />
        }
      />
      <SettingsRow
        title="Check every day"
        description="Fetches the signed release list once a day. Nothing installs until you choose to."
        control={
          <Switch
            aria-label="Check every day"
            checked={checkDaily}
            disabled={saving}
            onCheckedChange={onCheckDaily}
          />
        }
      />
    </SettingsSection>
  );
}
