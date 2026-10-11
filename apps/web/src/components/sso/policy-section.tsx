import type { SsoProvider } from '@bemmoly/shared';
import { Card, CardHeader, ConfirmChange, SettingsRow, Switch } from '@bemmoly/ui';
import { useState } from 'react';
import type { SsoPolicyState } from '../../hooks/use-sso-admin.ts';
import { describeError } from '../../lib/errors.ts';
import { Notice } from '../form.tsx';
import { BreakGlassAdmins } from './break-glass-admins.tsx';

interface PolicySectionProps {
  policy: SsoPolicyState;
  providers: readonly SsoProvider[];
}

/** Why the switch cannot turn on yet, or null when it can. */
function blocker(policy: SsoPolicyState, providers: readonly SsoProvider[]): string | null {
  if (!providers.some((provider) => provider.enabled && provider.lastTest?.ok)) {
    return 'Run a successful test sign-in with an identity provider first.';
  }
  if ((policy.policy?.breakGlassAdmins.length ?? 0) === 0) {
    return 'There is no break-glass admin who could still sign in with a password. Make one below.';
  }
  return null;
}

/**
 * "Require SSO for everyone": password sign-in off except for break-glass admins. Turning it on
 * asks first and says exactly who keeps a password; turning it off applies at once.
 */
export function PolicySection({ policy, providers }: PolicySectionProps) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const required = policy.policy?.requireSso ?? false;
  const blocked = required ? null : blocker(policy, providers);
  const admins = policy.policy?.breakGlassAdmins ?? [];
  const names = admins.map((admin) => admin.name).join(', ');
  const apply = async (next: boolean) => {
    setError(null);
    try {
      await policy.set(next);
      setConfirming(false);
    } catch (failure) {
      setError(describeError(failure).message);
    }
  };
  return (
    <Card>
      <CardHeader title="Sign-in policy" />
      <div className="px-4 pb-2">
        <SettingsRow
          title="Require single sign-on for everyone"
          description={
            blocked ??
            (required
              ? 'Password sign-in is off, except for break-glass admins.'
              : 'Turns password sign-in off, except for break-glass admins.')
          }
          control={
            <Switch
              aria-label="Require single sign-on for everyone"
              checked={required}
              disabled={policy.saving || blocked !== null}
              onCheckedChange={(next) => (next ? setConfirming(true) : void apply(false))}
            />
          }
        />
        <SettingsRow
          title="Break-glass admins"
          description="Org admins who keep password sign-in while single sign-on is required, so someone can still get in if the identity provider is down. While it is required, at least one stays."
        />
        {policy.policy ? <BreakGlassAdmins policy={policy.policy} /> : null}
      </div>
      {error && !confirming ? (
        <div className="px-4 pb-4">
          <Notice tone="caution">{error}</Notice>
        </div>
      ) : null}
      <ConfirmChange
        open={confirming}
        title="Require single sign-on for everyone?"
        consequences={[
          'Everyone else signs in through your identity provider from now on; their password stops working.',
          `Break-glass admins keep their password: ${names}.`,
          'Invitations are accepted by signing in with single sign-on, not by setting a password.',
          'If the identity provider is down, only break-glass admins can sign in.',
        ]}
        confirmLabel="Require single sign-on"
        tone="caution"
        busy={policy.saving}
        error={error}
        onConfirm={() => void apply(true)}
        onCancel={() => setConfirming(false)}
      />
    </Card>
  );
}
