import { formatBytes, formatDateTime } from '@bemmoly/core-web';
import type { Backup } from '@bemmoly/shared';
import {
  Button,
  buttonClassName,
  Card,
  CardHeader,
  EmptyState,
  Table,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { LINK_ACTION } from '../actions.ts';
import { KIND, STATUS, VERIFICATION, WHERE } from './backup-labels.ts';
import { StatePill } from '../settings/state-pill.tsx';

interface BackupsTableProps {
  backups: readonly Backup[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** The backup whose check or drill is being started. */
  busyId: string | null;
  /** Writes are paused while the server is in maintenance. */
  paused: boolean;
  /** How long a restore keeps the database it replaces. */
  keepDays: number;
  onCheck: (id: string) => void;
  onDrill: (id: string) => void;
  onRestore: (id: string) => void;
  downloadUrl: (id: string) => string;
}

const PAUSED = 'Paused while Bemmoly is in maintenance';

/**
 * The Backups card of the mock. Restore is the first action on every row that can be
 * restored, placed before Verification so it stays in view on narrow screens; the archive
 * check and the drill sit with the verification they update. The grid keeps a minimum width
 * and scrolls inside the card rather than clipping columns.
 */
export function BackupsTable(props: BackupsTableProps) {
  const { backups, hasMore, loadingMore, onLoadMore, busyId, paused, downloadUrl } = props;
  const columns: TableColumn<Backup>[] = [
    {
      key: 'created',
      header: 'Created',
      width: '104px',
      render: (backup) => <span className="text-tx-2">{formatDateTime(backup.createdAt)}</span>,
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '100px',
      hideOnPhone: true,
      render: (backup) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-tx-2">{KIND[backup.kind]}</span>
          <span className="text-12 text-tx-3">{backup.attachmentMode}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'minmax(120px,1fr)',
      render: (backup) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <StatePill tone={STATUS[backup.status].tone} stage={STATUS[backup.status].stage}>
            {STATUS[backup.status].label}
          </StatePill>
          {backup.error ? (
            <span className="max-w-50 truncate text-12 text-red" title={backup.error}>
              {backup.error}
            </span>
          ) : (
            <span className="text-12 text-tx-3">
              {backup.locations.map((location) => WHERE[location.destination]).join(' + ')}
              {backup.encrypted ? ' · encrypted' : ''}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      width: '72px',
      hideOnPhone: true,
      align: 'end',
      render: (backup) => (
        <span className="font-mono text-12">
          {backup.status === 'succeeded' ? formatBytes(backup.sizeBytes) : '—'}
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '56px',
      hideOnPhone: true,
      render: (backup) => <span className="font-mono text-12">{backup.appVersion}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '196px',
      render: (backup) =>
        backup.status === 'succeeded' ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              icon={<Icon name="restore" />}
              disabled={paused}
              title={paused ? PAUSED : undefined}
              aria-label={`Restore the backup from ${formatDateTime(backup.createdAt)}`}
              onClick={() => props.onRestore(backup.id)}
            >
              Restore…
            </Button>
            <a
              className={buttonClassName({ size: 'xs', variant: 'ghost' })}
              href={downloadUrl(backup.id)}
              download
              aria-label={`Download the backup from ${formatDateTime(backup.createdAt)}`}
            >
              <Icon name="download" />
              Download
            </a>
          </div>
        ) : (
          <span className="text-12 text-tx-3">Not restorable</span>
        ),
    },
    {
      key: 'verification',
      header: 'Verification',
      width: '170px',
      hideOnPhone: true,
      render: (backup) => (
        <div className="flex flex-col items-start gap-1">
          <span title={backup.verification.message ?? undefined}>
            <StatePill tone={VERIFICATION[backup.verification.state].tone}>
              {VERIFICATION[backup.verification.state].label}
            </StatePill>
          </span>
          {backup.status === 'succeeded' ? (
            <span className="flex items-center gap-1.5 text-12">
              <button
                type="button"
                className={LINK_ACTION}
                disabled={paused || busyId === backup.id}
                title="Reads the archive back and checks every part"
                onClick={() => props.onCheck(backup.id)}
              >
                Check archive
              </button>
              <span className="text-tx-3">·</span>
              <button
                type="button"
                className={LINK_ACTION}
                disabled={paused || busyId === backup.id}
                title="Restore drill: loads the backup into a scratch database and compares row counts"
                onClick={() => props.onDrill(backup.id)}
              >
                Run drill
              </button>
            </span>
          ) : null}
        </div>
      ),
    },
  ];
  const restorable = backups.filter((backup) => backup.status === 'succeeded').length;
  return (
    <Card>
      <CardHeader
        title="Backups"
        hint={<span className="whitespace-nowrap">{restorable} restorable</span>}
        actions={
          <span className="font-normal text-tx-3">
            Restore puts Bemmoly in maintenance mode, restores into a fresh database and keeps the
            replaced one for {props.keepDays} days.
          </span>
        }
      />
      <div className="overflow-x-auto">
        <Table
          label="Backups"
          className="rounded-none! border-0! sm:min-w-250"
          columns={columns}
          rows={backups}
          rowKey={(backup) => backup.id}
          footer={{ hasMore, loading: loadingMore, onLoadMore }}
          empty={
            <EmptyState
              title="No backups yet"
              description="The first scheduled backup runs at the time set above. Back up now to take one straight away."
            />
          }
        />
      </div>
    </Card>
  );
}
