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
  skipped: { label: 'SKIPPED', tone: 'neutral' },
};

const VERIFICATION: Record<Backup['verification'], { label: string; tone: BadgeTone }> = {
  verified: { label: 'VERIFIED', tone: 'ok' },
  pending: { label: 'PENDING', tone: 'neutral' },
  failed: { label: 'FAILED', tone: 'warn' },
  not_run: { label: 'NOT RUN', tone: 'outline' },
};

interface BackupsTableProps {
  backups: readonly Backup[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** The backup whose restore drill is running. */
  drillingId: string | null;
  onDrill: (id: string) => void;
  onRestore: (id: string) => void;
  downloadUrl: (id: string) => string;
}

export function BackupsTable({
  backups,
  hasMore,
  loadingMore,
  onLoadMore,
  drillingId,
  onDrill,
  onRestore,
  downloadUrl,
}: BackupsTableProps) {
  const columns: TableColumn<Backup>[] = [
    {
      key: 'started',
      header: 'Started',
      width: '120px',
      render: (backup) => <span className="text-tx2">{formatDateTime(backup.startedAt)}</span>,
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '100px',
      render: (backup) => <span className="text-tx3">{KIND[backup.kind]}</span>,
    },
    {
      key: 'tier',
      header: 'Tier',
      width: '72px',
      render: (backup) => (
        <span className="text-tx3 capitalize">
          {backup.tier ?? <span className="text-tx6">—</span>}
        </span>
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
          ) : null}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      width: '72px',
      align: 'end',
      render: (backup) => (
        <span className="font-mono text-12">{formatBytes(backup.sizeBytes)}</span>
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
      width: '96px',
      render: (backup) => (
        <Badge tone={VERIFICATION[backup.verification].tone}>
          {VERIFICATION[backup.verification].label}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '232px',
      align: 'end',
      render: (backup) =>
        backup.status === 'succeeded' ? (
          <div className="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="ghost"
              loading={drillingId === backup.id}
              onClick={() => onDrill(backup.id)}
            >
              Restore drill
            </Button>
            <a
              className={buttonClassName({ size: 'xs' })}
              href={downloadUrl(backup.id)}
              download
              aria-label={`Download ${backup.id}`}
            >
              Download
            </a>
            <Button size="xs" onClick={() => onRestore(backup.id)}>
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
