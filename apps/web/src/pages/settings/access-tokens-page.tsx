import { Button, ConfirmChange, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { FormError } from '../../components/form.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { CreateTokenModal } from '../../components/tokens/create-token-modal.tsx';
import { TokensSkeleton, TokensTable } from '../../components/tokens/tokens-table.tsx';
import { useApiTokens, useModuleNames } from '../../hooks/use-api-tokens.ts';

/**
 * Account › Access tokens: personal tokens that let MCP clients, IDEs and scripts reach this
 * workspace as you, through the API and the MCP server. Each secret shows once, at creation.
 */
export function AccessTokensPage() {
  const { query, tokens, revoking, ask, revoke } = useApiTokens();
  const modules = useModuleNames();
  const [creating, setCreating] = useState(false);
  const create = (
    <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreating(true)}>
      Create token
    </Button>
  );
  return (
    <SettingsPage
      title="Access tokens"
      description="Tokens let MCP clients, IDEs and scripts act as you, through the API and the MCP server. A token never has more access than you do."
      loading={query.isPending}
      skeleton={<TokensSkeleton />}
      error={query.error}
      actions={create}
    >
      <TokensTable
        tokens={tokens}
        moduleLabel={modules.label}
        onRevoke={ask}
        empty={
          <EmptyState
            icon={<Icon name="key" />}
            title="No access tokens yet"
            description="Create one to connect an MCP client or a script to this workspace."
            action={create}
          />
        }
      />
      <CreateTokenModal
        open={creating}
        onClose={() => setCreating(false)}
        modules={modules.options}
      />
      <ConfirmChange
        open={revoking !== null}
        title={`Revoke ${revoking?.name ?? 'token'}?`}
        consequences={[
          'Anything using this token stops working at once.',
          'This cannot be undone. Create a new token to reconnect.',
        ]}
        confirmLabel="Revoke token"
        busy={revoke.isPending}
        error={revoke.error ? <FormError error={revoke.error} /> : null}
        onConfirm={() => revoking && revoke.mutate(revoking)}
        onCancel={() => ask(null)}
      />
    </SettingsPage>
  );
}
