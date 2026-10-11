import type { CodeHost, CodeHostTestResult } from '@bemmoly/shared';
import { Button, IconButton, Menu, MenuItem, RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { HOST_LABELS, hostState, type CodeHosts } from '../../hooks/use-code-hosts.ts';
import { describeError } from '../../lib/errors.ts';
import { toast } from '../../lib/toast.ts';
import { AuthMethodCard } from '../people/auth-method-card.tsx';
import { HostTile } from './host-mark.tsx';

function TestLines({ result }: { result: CodeHostTestResult }) {
  const line = (ok: boolean | null, message: string) => (
    <span className="flex items-start gap-1.5">
      <span className={ok === false ? 'text-red' : ok ? 'text-green' : 'text-tx-3'}>
        <Icon
          name={ok === false ? 'close' : ok ? 'check' : 'minus'}
          size={14}
          label={ok === false ? 'Failed' : ok ? 'Passed' : 'Skipped'}
        />
      </span>
      <span className={ok === false ? 'text-red-tx' : ''}>{message}</span>
    </span>
  );
  return (
    <span role="status" className="flex flex-col gap-1 text-12">
      {line(result.webhook.ok, result.webhook.message)}
      {line(result.api.ok, result.api.message)}
    </span>
  );
}

function describe(host: CodeHost, test: CodeHostTestResult | undefined) {
  const where = host.baseUrl ?? (host.kind === 'github' ? 'github.com' : 'gitlab.com');
  const how = host.authMode === 'app' ? `GitHub App ${host.appId ?? ''}`.trim() : 'access token';
  const repos = host.repositories.length;
  const last = host.lastDelivery;
  return (
    <span className="flex flex-col gap-1">
      <span>
        {where} · {how} · {repos === 0 ? 'no repositories to backfill' : `${repos} to backfill`}
      </span>
      <span className="text-12">
        {last ? (
          <>
            Last delivery <RelativeTime iso={last.receivedAt} />: {last.summary}
          </>
        ) : (
          'Nothing received yet. Add the webhook, then send a test delivery.'
        )}
      </span>
      {host.lastError && <span className="text-12 text-red-tx">{host.lastError}</span>}
      {test && <TestLines result={test} />}
    </span>
  );
}

interface HostCardProps {
  host: CodeHost;
  hosts: CodeHosts;
  onEdit: () => void;
  onDeliveries: () => void;
  onDelete: () => void;
}

/** One connected host: its state, where deliveries stand, and its actions. */
export function HostCard({ host, hosts, onEdit, onDeliveries, onDelete }: HostCardProps) {
  const toggle = () =>
    hosts
      .update(host.id, { enabled: !host.enabled })
      .catch((error: unknown) => toast(describeError(error).message, 'danger'));
  return (
    <AuthMethodCard
      tile={<HostTile kind={host.kind} />}
      name={host.name}
      active={host.enabled && !host.lastError && Boolean(host.lastDelivery)}
      state={hostState(host)}
      description={describe(host, hosts.lastTest(host.id))}
      actions={
        <>
          <Button
            size="sm"
            loading={hosts.testing === host.id}
            disabled={!host.enabled}
            onClick={() => hosts.test(host.id)}
          >
            Send test delivery
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            Edit…
          </Button>
          <span className="ml-auto">
            <Menu
              align="end"
              widthClassName="w-56"
              trigger={(props) => (
                <IconButton {...props} label={`Actions for ${host.name}`} icon="more" size="xs" />
              )}
            >
              <MenuItem onSelect={onDeliveries}>Recent deliveries</MenuItem>
              <MenuItem
                disabled={!host.enabled || host.repositories.length === 0 || !host.hasCredentials}
                onSelect={() => hosts.backfill(host.id)}
              >
                Backfill the last 30 days
              </MenuItem>
              <MenuItem onSelect={() => void toggle()}>
                {host.enabled ? 'Turn off' : 'Turn on'}
              </MenuItem>
              <MenuItem tone="danger" onSelect={onDelete}>
                Remove {HOST_LABELS[host.kind]}…
              </MenuItem>
            </Menu>
          </span>
        </>
      }
    />
  );
}
