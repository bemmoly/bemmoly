import type { CodeHost } from '@bemmoly/shared';
import { Button, ConfirmChange } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { DeliveriesDialog } from '../../components/code-hosts/deliveries-dialog.tsx';
import { HostCard } from '../../components/code-hosts/host-card.tsx';
import { HostDialog } from '../../components/code-hosts/host-dialog.tsx';
import { HostTile } from '../../components/code-hosts/host-mark.tsx';
import { Notice } from '../../components/form.tsx';
import { AuthMethodCard } from '../../components/people/auth-method-card.tsx';
import { SettingsPage } from '../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../components/settings/settings-states.tsx';
import { CODE_HOSTS_CAPABILITY, HOST_LABELS, useCodeHosts } from '../../hooks/use-code-hosts.ts';
import { useSearchParam } from '../../hooks/use-search-param.ts';
import { useMe } from '../../hooks/use-session.ts';
import { describeError } from '../../lib/errors.ts';

/**
 * Settings › Integrations › Code hosts: connect GitHub or GitLab so pull requests, branches and
 * commits that name an issue key show on that issue. One card per host with its state, the
 * test delivery and its actions. The open dialog is in the address (`?host=new`, `new:<kind>`
 * or an id; `?deliveries=<id>`), so reload and Back keep it.
 */
export function CodeHostsPage() {
  const me = useMe();
  const allowed = me.can(CODE_HOSTS_CAPABILITY);
  const hosts = useCodeHosts(allowed);
  const [hostParam, setHost] = useSearchParam('host');
  const [deliveriesParam, setDeliveries] = useSearchParam('deliveries');
  const [removing, setRemoving] = useState<CodeHost | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const add = () => setHost('new');
  const deliveriesFor = hosts.items.find((host) => host.id === deliveriesParam);

  const confirmRemove = async () => {
    if (!removing) return;
    try {
      await hosts.remove(removing.id);
      setRemoving(null);
    } catch (error) {
      setRemoveError(describeError(error).message);
    }
  };

  return (
    <SettingsPage
      title="Code hosts"
      description="Connect GitHub or GitLab. Pull requests, branches and commits that name an issue key show on that issue, with their state."
      actions={
        allowed ? (
          <Button size="sm" icon={<Icon name="plus" />} onClick={add}>
            Connect a code host…
          </Button>
        ) : null
      }
      loading={allowed && hosts.query.isPending}
      skeleton={<SettingsSkeleton sections={2} rows={2} />}
      error={hosts.query.error}
    >
      {allowed ? (
        <>
          <section aria-label="Code hosts" className="grid gap-3 sm:grid-cols-2">
            {hosts.items.map((host) => (
              <HostCard
                key={host.id}
                host={host}
                hosts={hosts}
                onEdit={() => setHost(host.id)}
                onDeliveries={() => setDeliveries(host.id)}
                onDelete={() => {
                  setRemoveError(null);
                  setRemoving(host);
                }}
              />
            ))}
            {hosts.items.length === 0 && (
              <>
                {(['github', 'gitlab'] as const).map((kind) => (
                  <AuthMethodCard
                    key={kind}
                    tile={<HostTile kind={kind} />}
                    name={HOST_LABELS[kind]}
                    state={{ tone: 'neutral', label: 'Not connected' }}
                    description={
                      kind === 'github'
                        ? 'github.com or Enterprise Server, as a GitHub App or with a token.'
                        : 'gitlab.com or self-managed, with a project or group access token.'
                    }
                    actions={
                      <Button size="sm" onClick={() => setHost(`new:${kind}`)}>
                        Connect {HOST_LABELS[kind]}…
                      </Button>
                    }
                  />
                ))}
              </>
            )}
          </section>
          <p className="m-0 text-13 leading-body text-tx-3">
            Each project chooses whether linked pull requests move its issues, in its settings under
            Development.
          </p>
          <HostDialog state={hostParam} hosts={hosts} onState={setHost} />
          {deliveriesFor && (
            <DeliveriesDialog host={deliveriesFor} onClose={() => setDeliveries(null)} />
          )}
          <ConfirmChange
            open={removing !== null}
            title={`Remove ${removing?.name ?? 'this code host'}?`}
            consequences={[
              'Its links leave every issue, and its deliveries stop being accepted.',
              'Its stored secrets are deleted and can’t be recovered.',
            ]}
            confirmLabel="Remove code host"
            tone="danger"
            error={removeError}
            onConfirm={() => void confirmRemove()}
            onCancel={() => setRemoving(null)}
          />
        </>
      ) : (
        <Notice>
          Only people who can manage workspace settings see code hosts. Ask an org admin.
        </Notice>
      )}
    </SettingsPage>
  );
}
