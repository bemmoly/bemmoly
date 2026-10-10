import type { AiProvider } from '@bemmoly/shared';
import {
  Button,
  Card,
  CardHeader,
  ConfirmChange,
  IconButton,
  Menu,
  MenuItem,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { providerKind, providerStatus, type AiProviders } from '../../hooks/use-ai-providers.ts';
import { describeError } from '../../lib/errors.ts';
import { StatePill } from '../settings/state-pill.tsx';
import { ProviderLogo } from './provider-logo.tsx';

interface ProvidersSectionProps {
  providers: AiProviders;
  onAdd: () => void;
}

function Status({ provider }: { provider: AiProvider }) {
  const status = providerStatus(provider);
  const tone = status.tone === 'danger' ? 'red' : status.tone;
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5">
      <StatePill tone={tone} icon={status.tone === 'danger' ? 'warning' : undefined}>
        {status.label}
      </StatePill>
      {status.detail ? (
        <span title={status.detail} className="max-w-full truncate text-12 text-red-tx">
          {status.detail}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The connected providers, one quiet table: who it is, whether it answers (with its own error
 * when it doesn't), when that was checked, and Test and Remove per row.
 */
export function ProvidersSection({ providers, onAdd }: ProvidersSectionProps) {
  const [removing, setRemoving] = useState<AiProvider | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const columns: TableColumn<AiProvider>[] = [
    {
      key: 'name',
      header: 'Provider',
      width: 'minmax(0,1.6fr)',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <ProviderLogo id={row.catalogId} name={row.name} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium text-tx">{row.name}</span>
            <span className="truncate text-12 text-tx-3">{providerKind(row)}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'minmax(0,1.2fr)',
      render: (row) => <Status provider={row} />,
    },
    {
      key: 'checked',
      header: 'Last test',
      width: '110px',
      hideOnPhone: true,
      render: (row) =>
        row.lastCheckedAt ? (
          <RelativeTime iso={row.lastCheckedAt} className="text-12 text-tx-3" />
        ) : (
          <span className="text-12 text-tx-3">Never</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '132px',
      align: 'end',
      render: (row) => (
        <span className="flex items-center gap-1">
          <Button
            size="sm"
            loading={providers.testing === row.id}
            onClick={() => providers.test(row.id)}
          >
            Test
          </Button>
          <Menu
            align="end"
            widthClassName="w-52"
            trigger={(props) => (
              <IconButton {...props} label={`Actions for ${row.name}`} icon="more" size="xs" />
            )}
          >
            <MenuItem
              tone="danger"
              onSelect={() => {
                setRemoveError(null);
                setRemoving(row);
              }}
            >
              Remove provider…
            </MenuItem>
          </Menu>
        </span>
      ),
    },
  ];
  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await providers.remove(removing.id);
      setRemoving(null);
    } catch (error) {
      setRemoveError(describeError(error).message);
    }
  };
  return (
    <Card>
      <CardHeader
        title="Providers"
        hint="Any provider's model can fill any role"
        actions={
          <Button size="xs" icon={<Icon name="plus" />} onClick={onAdd}>
            Add provider…
          </Button>
        }
      />
      {providers.query.isPending ? (
        <TableSkeleton label="Loading providers" columns={columns} rows={2} />
      ) : (
        <Table
          label="Connected providers"
          className="rounded-none! border-0!"
          columns={columns}
          rows={providers.items}
          rowKey={(row) => row.id}
          empty={
            <span className="block px-4 py-5 text-13 text-tx-3">
              No provider is connected. Add one to choose models for each role.
            </span>
          }
        />
      )}
      <ConfirmChange
        open={removing !== null}
        title={`Remove ${removing?.name ?? 'this provider'}?`}
        consequences={[
          'Its stored keys are deleted and can’t be recovered.',
          'Roles must use another provider first; Bemmoly says which ones if any still do.',
        ]}
        confirmLabel="Remove provider"
        tone="danger"
        busy={providers.removing}
        error={removeError}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  );
}
