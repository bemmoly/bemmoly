import { formatBytes, formatDateTime } from '@bemmoly/core-web';
import type { Backup } from '@bemmoly/shared';
import {
  Badge,
  Button,
  buttonClassName,
  EmptyState,
  Table,
  type BadgeTone,
  type TableColumn,
} from '@bemmoly/ui';

const KIND: Record<Backup['kind'], string> = {
  scheduled: 'Scheduled',
  pre_upgrade: 'Before update',
  manual: 'Manual',
};

const STATUS: Record<Backup['status'], { label: string; tone: BadgeTone }> = {
  running: { label: 'RUNNING', tone: 'accent' },
  succeeded: { label: 'SUCCEEDED', tone: 'ok' },
  failed: { label: 'FAILED', tone: 'warn' },
  pruned: { label: 'PRUNED', tone: 'neutral' },
};

const VERIFICATION: Record<Backup['verification']['state'], { label: string; tone: BadgeTone }> = {
  restored: { label: 'VERIFIED', tone: 'ok' },
  listed: { label: 'ARCHIVE OK', tone: 'accent' },
  pending: { label: 'PENDING', tone: 'neutral' },
  failed: { label: 'FAILED', tone: 'warn' },
};

const WHERE: Record<Backup['locations'][number]['destination'], string> = {
  local: 'Local',
  s3: 'S3',
};

interface BackupsTableProps {
  backups: readonly Backup[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** The backup whose check or drill is being started. */
  busyId: string | null;
  /** Writes are paused while the server is in maintenance. */
  paused: boolean;
  onCheck: (id: string) => void;
  onDrill: (id: string) => void;
  onRestore: (id: string) => void;
  downloadUrl: (id: string) => string;
}

export function BackupsTable(props: BackupsTableProps) {
  const { backups, hasMore, loadingMore, onLoadMore, busyId, paused, downloadUrl } = props;
  const columns: TableColumn<Backup>[] = [
    {
      key: 'created',
      header: 'Created',
      width: '112px',
      render: (backup) => <span className="text-tx2">{formatDateTime(backup.createdAt)}</span>,
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '104px',
      render: (backup) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-tx3">{KIND[backup.kind]}</span>
          <span className="text-12 text-tx5">{backup.attachmentMode}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'minmax(0,1fr)',
      render: (backup) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <Badge tone={STATUS[backup.status].tone}>{STATUS[backup.status].label}</Badge>
          {backup.error ? (
            <span className="max-w-full truncate text-12 text-danger" title={backup.error}>
              {backup.error}
            </span>
          ) : (
            <span className="text-12 text-tx5">
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
      width: '64px',
      render: (backup) => <span className="font-mono text-12">{backup.appVersion}</span>,
    },
    {
      key: 'verification',
      header: 'Verification',
      width: '100px',
      render: (backup) => (
        <span title={backup.verification.message ?? undefined}>
          <Badge tone={VERIFICATION[backup.verification.state].tone}>
            {VERIFICATION[backup.verification.state].label}
          </Badge>
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '300px',
      align: 'end',
      render: (backup) =>
        backup.status === 'succeeded' ? (
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="ghost"
              disabled={paused || busyId === backup.id}
              onClick={() => props.onCheck(backup.id)}
            >
              Check archive
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={paused || busyId === backup.id}
              onClick={() => props.onDrill(backup.id)}
            >
              Restore drill
            </Button>
            <a
              className={buttonClassName({ size: 'xs' })}
              href={downloadUrl(backup.id)}
              download
              aria-label={`Download the backup from ${formatDateTime(backup.createdAt)}`}
            >
              Download
            </a>
            <Button size="xs" disabled={paused} onClick={() => props.onRestore(backup.id)}>
              Restore
            </Button>
          </div>
        ) : null,
    },
  ];
  return (
    <Table
      label="Backups"
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
  );
}
