import type { OAuthGrant } from '@bemmoly/shared';
import {
  ConfirmChange,
  EmptyState,
  IconButton,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { grantAccessLabel, useConnectedApps } from '../../hooks/use-connected-apps.ts';
import { FormError } from '../form.tsx';
import { SettingsFailure } from '../settings/settings-states.tsx';

const WIDTH = {
  app: 'minmax(0,1.6fr)',
  access: 'minmax(0,1fr)',
  modules: 'minmax(0,1fr)',
  used: '110px',
  revoke: '40px',
};
const WIDTHS = Object.values(WIDTH);

/**
 * Apps that signed in over MCP as this person (OAuth), beside the tokens they made by hand:
 * what each may do and where, when it was last used, and Disconnect, which ends it at once.
 */
export function ConnectedApps({ moduleLabel }: { moduleLabel: (ids: string[] | null) => string }) {
  const { query, grants, revoking, ask, revoke } = useConnectedApps();
  const columns: TableColumn<OAuthGrant>[] = [
    {
      key: 'app',
      header: 'App',
      width: WIDTH.app,
      render: (grant) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{grant.client.name}</span>
          <span className="truncate text-12 text-tx-3">{grant.client.host}</span>
        </span>
      ),
    },
    {
      key: 'access',
      header: 'Access',
      width: WIDTH.access,
      render: (grant) => <span className="truncate">{grantAccessLabel(grant)}</span>,
    },
    {
      key: 'modules',
      header: 'Modules',
      width: WIDTH.modules,
      hideOnPhone: true,
      render: (grant) => <span className="truncate">{moduleLabel(grant.modules)}</span>,
    },
    {
      key: 'used',
      header: 'Last used',
      width: WIDTH.used,
      hideOnPhone: true,
      render: (grant) =>
        grant.lastUsedAt ? (
          <RelativeTime iso={grant.lastUsedAt} />
        ) : (
          <span className="text-tx-3">Never</span>
        ),
    },
    {
      key: 'revoke',
      header: <span className="sr-only">Actions</span>,
      width: WIDTH.revoke,
      align: 'end',
      render: (grant) => (
        <IconButton
          icon="log-out"
          size="sm"
          label={`Disconnect ${grant.client.name}`}
          tip="Disconnect"
          onClick={() => ask(grant)}
        />
      ),
    },
  ];
  return (
    <section aria-labelledby="connected-apps-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="connected-apps-title" className="m-0 text-14 font-semibold text-tx">
          Connected apps
        </h2>
        <p className="m-0 text-13 leading-body text-tx-2">
          MCP clients connected by signing in. Each acts as you, with the access you chose when you
          connected it.
        </p>
      </div>
      {query.error ? (
        <SettingsFailure error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <TableSkeleton
          label="Loading connected apps"
          rows={2}
          columns={WIDTHS.map((width) => ({ width }))}
        />
      ) : (
        <Table
          label="Connected apps"
          columns={columns}
          rows={grants}
          rowKey={(grant) => grant.id}
          empty={
            <EmptyState
              icon={<Icon name="link" />}
              title="No connected apps"
              description="When an MCP client asks you to sign in, connect it there; it shows up here."
            />
          }
        />
      )}
      <ConfirmChange
        open={revoking !== null}
        title={`Disconnect ${revoking?.client.name ?? 'app'}?`}
        consequences={[
          'It stops reaching this workspace at once, on every device it was signed in on.',
          'To use it again, connect it again from the app; it asks you to sign in.',
        ]}
        confirmLabel="Disconnect app"
        busy={revoke.isPending}
        error={revoke.error ? <FormError error={revoke.error} /> : null}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onCancel={() => ask(null)}
      />
    </section>
  );
}
