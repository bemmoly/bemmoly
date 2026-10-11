import type { ApiToken } from '@bemmoly/shared';
import {
  Badge,
  IconButton,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import { accessLabel } from '../../hooks/use-api-tokens.ts';

const WIDTHS = ['minmax(0,1.6fr)', 'minmax(0,1fr)', 'minmax(0,1fr)', '110px', '120px', '40px'];

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' });

function expiry(token: ApiToken, now: number): ReactNode {
  if (!token.expiresAt) return <span className="text-tx-3">Never</span>;
  if (Date.parse(token.expiresAt) <= now) return <Badge tone="warn">Expired</Badge>;
  return dateOf(token.expiresAt);
}

interface TokensTableProps {
  tokens: readonly ApiToken[];
  moduleLabel: (modules: readonly string[] | null) => string;
  onRevoke: (token: ApiToken) => void;
  empty: ReactNode;
}

/** The person's tokens: what each can do and where, when it was last used and when it stops. */
export function TokensTable({ tokens, moduleLabel, onRevoke, empty }: TokensTableProps) {
  const [now] = useState(() => Date.now());
  const columns: TableColumn<ApiToken>[] = [
    {
      key: 'name',
      header: 'Name',
      width: 'minmax(0,1.6fr)',
      render: (token) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{token.name}</span>
          <code className="truncate font-mono text-12 text-tx-3">{token.prefix}</code>
        </span>
      ),
    },
    {
      key: 'access',
      header: 'Access',
      width: 'minmax(0,1fr)',
      render: (token) => <span className="truncate">{accessLabel(token)}</span>,
    },
    {
      key: 'modules',
      header: 'Modules',
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (token) => <span className="truncate">{moduleLabel(token.modules)}</span>,
    },
    {
      key: 'used',
      header: 'Last used',
      width: '110px',
      hideOnPhone: true,
      render: (token) =>
        token.lastUsedAt ? (
          <RelativeTime iso={token.lastUsedAt} />
        ) : (
          <span className="text-tx-3">Never</span>
        ),
    },
    {
      key: 'expires',
      header: 'Expires',
      width: '120px',
      hideOnPhone: true,
      render: (token) => expiry(token, now),
    },
    {
      key: 'revoke',
      header: <span className="sr-only">Actions</span>,
      width: '40px',
      align: 'end',
      render: (token) => (
        <IconButton
          icon="trash"
          size="sm"
          label={`Revoke ${token.name}`}
          tip="Revoke"
          onClick={() => onRevoke(token)}
        />
      ),
    },
  ];
  return (
    <Table
      label="Access tokens"
      columns={columns}
      rows={tokens}
      rowKey={(token) => token.id}
      empty={empty}
    />
  );
}

/** The table while tokens load, with the same tracks so nothing shifts. */
export function TokensSkeleton() {
  return (
    <TableSkeleton
      label="Loading access tokens"
      rows={3}
      columns={WIDTHS.map((width) => ({ width }))}
    />
  );
}
