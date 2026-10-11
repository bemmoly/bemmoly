import type { CreatedScimToken, ScimToken } from '@bemmoly/shared';
import {
  Button,
  Card,
  CardHeader,
  ConfirmChange,
  Field,
  Input,
  Modal,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import type { ScimTokens } from '../../hooks/use-sso-admin.ts';
import { describeError } from '../../lib/errors.ts';
import { FormError, Notice } from '../form.tsx';
import { CopyValue } from './copy-value.tsx';

/** Name a token, create it, then show the secret once with the base URL beside it. */
function CreateTokenDialog({ tokens, onClose }: { tokens: ScimTokens; onClose: () => void }) {
  const [name, setName] = useState('Directory sync');
  const [created, setCreated] = useState<CreatedScimToken | null>(null);
  const [error, setError] = useState<unknown>(null);
  const create = async () => {
    setError(null);
    try {
      setCreated(await tokens.create(name));
    } catch (failure) {
      setError(failure);
    }
  };
  return (
    <Modal
      open
      width="md"
      onClose={onClose}
      title={created ? 'Copy the token now' : 'Create a SCIM token'}
      description={
        created
          ? 'It is shown once. Paste it with the base URL into your identity provider’s provisioning settings.'
          : 'Your identity provider uses it to create, update and deactivate people and teams here.'
      }
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={tokens.creating} onClick={() => void create()}>
              Create token
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="flex flex-col gap-3">
          <CopyValue label="Base URL" value={tokens.baseUrl} />
          <CopyValue label="Token" value={created.token} />
          <Notice tone="caution">Store it somewhere safe; Bemmoly keeps only a fingerprint.</Notice>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Name" hint="So you can tell tokens apart later.">
            <Input value={name} autoFocus onChange={(event) => setName(event.target.value)} />
          </Field>
          <FormError error={error} />
        </div>
      )}
    </Modal>
  );
}

/** SCIM provisioning: the base URL, the tokens in use, create and revoke. */
export function ScimSection({ tokens }: { tokens: ScimTokens }) {
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<ScimToken | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const columns: TableColumn<ScimToken>[] = [
    {
      key: 'name',
      header: 'Token',
      width: 'minmax(0,1.4fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{row.name}</span>
          <span className="truncate font-mono text-12 text-tx-3">{row.prefix}…</span>
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Last used',
      width: '120px',
      hideOnPhone: true,
      render: (row) =>
        row.lastUsedAt ? (
          <RelativeTime iso={row.lastUsedAt} className="text-12 text-tx-3" />
        ) : (
          <span className="text-12 text-tx-3">Never</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '96px',
      align: 'end',
      render: (row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setRevokeError(null);
            setRevoking(row);
          }}
        >
          Revoke…
        </Button>
      ),
    },
  ];
  const confirmRevoke = async () => {
    if (!revoking) return;
    try {
      await tokens.revoke(revoking.id);
      setRevoking(null);
    } catch (error) {
      setRevokeError(describeError(error).message);
    }
  };
  return (
    <Card>
      <CardHeader
        title="Provisioning (SCIM)"
        hint={
          <span className="max-sm:hidden">
            People and teams kept in step by your identity provider
          </span>
        }
        actions={
          <Button size="xs" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
            Create token…
          </Button>
        }
      />
      {tokens.baseUrl ? (
        <div className="px-4 pb-3">
          <CopyValue label="SCIM base URL" value={tokens.baseUrl} />
        </div>
      ) : null}
      {tokens.query.isPending ? (
        <TableSkeleton label="Loading SCIM tokens" columns={columns} rows={1} />
      ) : (
        <Table
          label="SCIM tokens"
          className="rounded-none! border-0!"
          columns={columns}
          rows={tokens.items}
          rowKey={(row) => row.id}
          empty={
            <span className="block px-4 py-5 text-13 text-tx-3">
              No token yet. Create one to let your identity provider provision people and teams.
            </span>
          }
        />
      )}
      {creating ? <CreateTokenDialog tokens={tokens} onClose={() => setCreating(false)} /> : null}
      <ConfirmChange
        open={revoking !== null}
        title={`Revoke ${revoking?.name ?? 'this token'}?`}
        consequences={[
          'Your identity provider stops provisioning with it at once.',
          'People and teams it created stay as they are.',
        ]}
        confirmLabel="Revoke token"
        tone="danger"
        busy={tokens.revoking}
        error={revokeError}
        onConfirm={() => void confirmRevoke()}
        onCancel={() => setRevoking(null)}
      />
    </Card>
  );
}
