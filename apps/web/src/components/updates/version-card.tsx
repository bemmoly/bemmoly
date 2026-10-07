import { formatRelative } from '@bemmoly/core-web';
import type { ReleaseChannel, UpdatesOverview } from '@bemmoly/shared';
import { Button, buttonClassName, Select, SettingsRow, SettingsSection, Switch } from '@bemmoly/ui';

const CHANNELS = [
  { value: 'stable', label: 'Stable' },
  { value: 'beta', label: 'Beta' },
];

interface VersionCardProps {
  overview: UpdatesOverview;
  channel: ReleaseChannel;
  checkDaily: boolean;
  saving: boolean;
  refreshing: boolean;
  uploading: boolean;
  onChannel: (channel: ReleaseChannel) => void;
  onCheckDaily: (on: boolean) => void;
  onRefresh: () => void;
  onUpload: (file: File) => void;
}

function checkedLine(checks: UpdatesOverview['checks']): string {
  const when = checks.lastCheckedAt
    ? `Release list last fetched ${formatRelative(checks.lastCheckedAt)}`
    : 'Release list not fetched yet';
  const signature =
    checks.manifest === 'unverified'
      ? ' · its signature is not checked in the app; the updater verifies images before installing'
      : '';
  return `${when}${signature}.`;
}

export function VersionCard(props: VersionCardProps) {
  const { overview, channel, checkDaily, saving } = props;
  const { current, checks } = overview;
  return (
    <SettingsSection title="This server" layout="rows">
      <SettingsRow
        title={
          <>
            Running <span className="font-mono text-12h">{current.version}</span>
          </>
        }
        description={checkedLine(checks)}
        control={
          <Button size="sm" loading={props.refreshing} onClick={props.onRefresh}>
            Refresh status
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
            onChange={(event) => props.onChannel(event.target.value as ReleaseChannel)}
          />
        }
      />
      <SettingsRow
        title="Check every day"
        description="The server fetches the release list once a day. Nothing installs until you choose to."
        control={
          <Switch
            aria-label="Check every day"
            checked={checkDaily}
            disabled={saving}
            onCheckedChange={props.onCheckDaily}
          />
        }
      />
      <SettingsRow
        title="Air-gapped install"
        description="No internet on this server? Upload a bemmoly-airgap-<version>.tar.gz release bundle."
        control={
          <label
            className={buttonClassName({ size: 'sm', className: 'focus-within:shadow-ring' })}
            aria-disabled={props.uploading}
          >
            <input
              type="file"
              accept=".tar.gz,.tar"
              className="sr-only"
              disabled={props.uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) props.onUpload(file);
                event.target.value = '';
              }}
            />
            {props.uploading ? 'Uploading…' : 'Upload bundle'}
          </label>
        }
      />
    </SettingsSection>
  );
}
