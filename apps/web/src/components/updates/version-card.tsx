import { formatRelative } from '@bemmoly/core-web';
import type { ReleaseChannel, UpdatesOverview } from '@bemmoly/shared';
import {
  Button,
  buttonClassName,
  Select,
  SettingsRow,
  SettingsSection,
  Switch,
  type SettingsSectionProps,
} from '@bemmoly/ui';
import type { UpdatePolicy } from '../../hooks/use-updates-settings.ts';

const CHANNELS = [
  { value: 'stable', label: 'Stable' },
  { value: 'beta', label: 'Beta' },
];

interface VersionCardProps {
  overview: UpdatesOverview;
  /** The edit state of the section: mode, Edit, Save, Cancel, dirty. */
  section: Omit<SettingsSectionProps, 'title' | 'children'>;
  /** The draft while editing, the stored values otherwise. */
  policy: UpdatePolicy;
  refreshing: boolean;
  uploading: boolean;
  onPolicy: (patch: Partial<UpdatePolicy>) => void;
  onRefresh: () => void;
  onUpload: (file: File) => void;
}

const valueText = 'text-13 font-medium text-tx';

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
  const { overview, policy, section } = props;
  const { current, checks } = overview;
  const editing = section.mode === 'edit';
  return (
    <SettingsSection
      title="This server"
      layout="rows"
      {...section}
      {...(editing ? { note: 'Channel and daily check save together.' } : {})}
    >
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
          editing ? (
            <Select
              aria-label="Update channel"
              wrapperClassName="w-40"
              options={CHANNELS}
              value={policy.channel}
              onChange={(event) =>
                props.onPolicy({ channel: event.target.value as ReleaseChannel })
              }
            />
          ) : (
            <span className={valueText}>{policy.channel === 'beta' ? 'Beta' : 'Stable'}</span>
          )
        }
      />
      <SettingsRow
        title="Check every day"
        description="The server fetches the release list once a day. Nothing installs until you choose to."
        control={
          editing ? (
            <Switch
              aria-label="Check every day"
              checked={policy.checkDaily}
              onCheckedChange={(checkDaily) => props.onPolicy({ checkDaily })}
            />
          ) : (
            <span className={valueText}>{policy.checkDaily ? 'On' : 'Off'}</span>
          )
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
