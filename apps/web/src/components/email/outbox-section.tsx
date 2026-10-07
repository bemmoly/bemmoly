import { formatRelative } from '@bemmoly/core-web';
import type { OutboxSummary } from '@bemmoly/shared';
import { Badge, SettingsSection, Table, type TableColumn } from '@bemmoly/ui';
import { FormError, Loading, Notice } from '../form.tsx';

type Failure = OutboxSummary['recentFailures'][number];

const COLUMNS: TableColumn<Failure>[] = [
  {
    key: 'to',
    header: 'Recipient',
    width: 'minmax(0,1fr)',
    render: (row) => <span className="truncate">{row.to ?? 'Unknown'}</span>,
  },
  {
    key: 'subject',
    header: 'Subject',
    width: 'minmax(0,1.4fr)',
    render: (row) => <span className="truncate text-tx2">{row.subject ?? '(no subject)'}</span>,
  },
  {
    key: 'error',
    header: 'Last error',
    width: 'minmax(0,1.4fr)',
    render: (row) => (
      <span title={row.lastError ?? undefined} className="truncate font-mono text-11 text-tx4">
        {row.lastError ?? '—'}
      </span>
    ),
  },
  {
    key: 'attempts',
    header: 'Tries',
    width: '48px',
    align: 'end',
    render: (row) => <span className="font-mono text-11 text-tx4">{row.attempts ?? '—'}</span>,
  },
  {
    key: 'failedAt',
    header: 'Failed',
    width: '84px',
    align: 'end',
    render: (row) => (
      <span className="text-12 text-tx4">
        {formatRelative(row.failedAt ?? row.createdAt ?? null)}
      </span>
    ),
  },
];

const TONES: Record<string, 'ok' | 'warn' | 'neutral' | 'accent'> = {
  sent: 'ok',
  failed: 'warn',
  queued: 'accent',
  sending: 'accent',
};

interface OutboxSectionProps {
  loading: boolean;
  error: unknown;
  status: string | null;
  failing: boolean;
  counts: Array<{ label: string; count: number }>;
  failures: readonly Failure[];
}

/** The outbox: one line on what failed and why, the counts, and the latest failures. */
export function OutboxSection({
  loading,
  error,
  status,
  failing,
  counts,
  failures,
}: OutboxSectionProps) {
  return (
    <SettingsSection
      title="Outbox"
      hint={
        counts.length ? (
          <span className="flex gap-1.5">
            {counts.map((entry) => (
              <Badge key={entry.label} tone={TONES[entry.label] ?? 'neutral'}>
                {entry.count} {entry.label}
              </Badge>
            ))}
          </span>
        ) : undefined
      }
    >
      {loading ? <Loading label="Loading the outbox" lines={2} /> : null}
      <FormError error={error} />
      {status ? <Notice tone={failing ? 'caution' : 'accent'}>{status}</Notice> : null}
      {failures.length ? (
        <Table
          label="Recent failed emails"
          density="sm"
          columns={COLUMNS}
          rows={failures}
          rowKey={(row) => row.id ?? `${row.to ?? ''}-${row.failedAt ?? row.createdAt ?? ''}`}
        />
      ) : null}
    </SettingsSection>
  );
}
