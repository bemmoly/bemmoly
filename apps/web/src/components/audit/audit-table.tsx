import { formatDateTime } from '@bemmoly/core-web';
import type { AuditEntry } from '@bemmoly/shared';
import { EmptyState, Table, type TableColumn } from '@bemmoly/ui';

const DASH = <span className="text-tx-3">—</span>;

interface AuditTableProps {
  entries: readonly AuditEntry[];
  actorOf: (entry: AuditEntry) => string;
  filtered: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

export function AuditTable({
  entries,
  actorOf,
  filtered,
  hasMore,
  loadingMore,
  onLoadMore,
}: AuditTableProps) {
  const columns: TableColumn<AuditEntry>[] = [
    {
      key: 'when',
      header: 'When',
      width: '112px',
      render: (entry) => (
        <time dateTime={entry.createdAt} className="text-tx-2">
          {formatDateTime(entry.createdAt)}
        </time>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (entry) => <span className="block truncate font-medium">{actorOf(entry)}</span>,
    },
    {
      key: 'action',
      header: 'Action',
      width: 'minmax(0,1.2fr)',
      render: (entry) => <span className="block truncate font-mono text-12">{entry.action}</span>,
    },
    {
      key: 'target',
      header: 'Target',
      width: 'minmax(0,1.2fr)',
      hideOnPhone: true,
      render: (entry) => (
        <span className="block truncate">
          <span className="text-tx-3">{entry.targetKind}</span>
          {entry.targetId ? (
            <span className="ml-1.5 font-mono text-12">{entry.targetId}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'IP',
      width: '96px',
      hideOnPhone: true,
      render: (entry) =>
        entry.ip ? <span className="font-mono text-12 text-tx-2">{entry.ip}</span> : DASH,
    },
    {
      key: 'request',
      header: 'Request id',
      width: '112px',
      hideOnPhone: true,
      render: (entry) =>
        entry.requestId ? (
          <span className="block truncate font-mono text-12 text-tx-3" title={entry.requestId}>
            {entry.requestId}
          </span>
        ) : (
          DASH
        ),
    },
  ];
  return (
    <Table
      label="Audit log"
      columns={columns}
      rows={entries}
      rowKey={(entry) => entry.id}
      density="sm"
      footer={{ hasMore, loading: loadingMore, onLoadMore }}
      empty={
        <EmptyState
          title={filtered ? 'Nothing matches these filters' : 'Nothing recorded yet'}
          description={
            filtered
              ? 'Widen the dates or clear a filter.'
              : 'Changes to people, roles, settings, modules, backups and updates appear here.'
          }
        />
      }
    />
  );
}
