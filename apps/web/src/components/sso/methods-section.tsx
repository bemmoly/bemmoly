import type { SsoPolicy, SsoProvider } from '@bemmoly/shared';
import { Button, ConfirmChange, IconButton, Menu, MenuItem, RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { providerState, type SsoProviders } from '../../hooks/use-sso-admin.ts';
import { describeError } from '../../lib/errors.ts';
import { toast } from '../../lib/toast.ts';
import { presetFor } from '../../lib/sso-presets.ts';
import { AuthMethodCard } from '../people/auth-method-card.tsx';
import { BrandTile } from '../setup/choice-card.tsx';
import { SsoTile } from './sso-mark.tsx';

function TestLine({ provider }: { provider: SsoProvider }) {
  const test = provider.lastTest;
  if (!test) return <>Run a test sign-in before people use it.</>;
  if (test.ok) {
    return (
      <>
        Test sign-in as {test.email} <RelativeTime iso={test.at} />
        {test.groups.length ? ` · groups ${test.groups.join(', ')}` : ''}
      </>
    );
  }
  return (
    <span className="text-red-tx">
      Test failed <RelativeTime iso={test.at} />: {test.message}
    </span>
  );
}

function describe(provider: SsoProvider) {
  const protocol = provider.protocol === 'oidc' ? 'OpenID Connect' : 'SAML 2.0';
  const domains = provider.allowedDomains.length
    ? provider.allowedDomains.join(', ')
    : 'any domain';
  const joins = provider.autoProvision ? 'new people get an account' : 'existing accounts only';
  return (
    <span className="flex flex-col gap-1">
      <span>
        {protocol} · {domains} · {joins}
      </span>
      <span className="text-12">
        <TestLine provider={provider} />
      </span>
    </span>
  );
}

interface MethodsSectionProps {
  providers: SsoProviders;
  policy: SsoPolicy | null;
  onEdit: (id: string) => void;
  onAdd: () => void;
}

/** Password first, then one card per identity provider, with Test and Edit on each. */
export function MethodsSection({ providers, policy, onEdit, onAdd }: MethodsSectionProps) {
  const [deleting, setDeleting] = useState<SsoProvider | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const required = policy?.requireSso ?? false;
  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await providers.remove(deleting.id);
      setDeleting(null);
    } catch (error) {
      setDeleteError(describeError(error).message);
    }
  };
  return (
    <section aria-label="Sign-in methods" className="grid gap-3 sm:grid-cols-2">
      <AuthMethodCard
        tile={<BrandTile initials="PW" icon={<Icon name="lock" size={16} />} />}
        name="Password"
        active={!required}
        state={required ? { tone: 'warn', label: 'Break-glass only' } : { tone: 'ok', label: 'On' }}
        description={
          required
            ? 'Only break-glass admins sign in with a password while single sign-on is required.'
            : 'Email and password, for everyone with an account.'
        }
      />
      {providers.items.map((provider) => (
        <AuthMethodCard
          key={provider.id}
          tile={<SsoTile preset={presetFor(provider)} />}
          name={provider.displayName}
          active={provider.enabled && provider.lastTest?.ok === true}
          state={providerState(provider)}
          description={describe(provider)}
          actions={
            <>
              <Button
                size="sm"
                loading={providers.testing === provider.id}
                onClick={() => providers.test(provider.id)}
              >
                Test sign-in
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onEdit(provider.id)}>
                Edit…
              </Button>
              <span className="ml-auto">
                <Menu
                  align="end"
                  widthClassName="w-56"
                  trigger={(props) => (
                    <IconButton
                      {...props}
                      label={`Actions for ${provider.displayName}`}
                      icon="more"
                      size="xs"
                    />
                  )}
                >
                  <MenuItem
                    onSelect={() =>
                      providers
                        .update(provider.id, { enabled: !provider.enabled })
                        .catch((error: unknown) => toast(describeError(error).message, 'danger'))
                    }
                  >
                    {provider.enabled ? 'Turn off' : 'Turn on'}
                  </MenuItem>
                  <MenuItem
                    tone="danger"
                    onSelect={() => {
                      setDeleteError(null);
                      setDeleting(provider);
                    }}
                  >
                    Delete provider…
                  </MenuItem>
                </Menu>
              </span>
            </>
          }
        />
      ))}
      {providers.items.length === 0 ? (
        <AuthMethodCard
          tile={<BrandTile initials="ID" icon={<Icon name="key" size={16} />} />}
          name="Single sign-on"
          state={{ tone: 'neutral', label: 'Not set up' }}
          description="Let people sign in through your identity provider, with OpenID Connect or SAML 2.0."
          actions={
            <Button size="sm" icon={<Icon name="plus" />} onClick={onAdd}>
              Add identity provider…
            </Button>
          }
        />
      ) : null}
      <ConfirmChange
        open={deleting !== null}
        title={`Delete ${deleting?.displayName ?? 'this provider'}?`}
        consequences={[
          'People keep their accounts; they sign in another way until it is added again.',
          'Its stored secrets are deleted and can’t be recovered.',
        ]}
        confirmLabel="Delete provider"
        tone="danger"
        busy={providers.removing}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
