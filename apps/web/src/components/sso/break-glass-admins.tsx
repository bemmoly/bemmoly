import type { SsoPolicy, SsoPolicyAdmin } from '@bemmoly/shared';
import { Avatar, Badge, Button, ConfirmChange } from '@bemmoly/ui';
import { useState } from 'react';
import { useBreakGlass } from '../../hooks/use-sso-admin.ts';
import { describeError } from '../../lib/errors.ts';

interface Pending {
  admin: SsoPolicyAdmin;
  breakGlass: boolean;
}

/** Why a row's action is unavailable, or null when it can be used. */
function blockedReason(admin: SsoPolicyAdmin, policy: SsoPolicy): string | null {
  if (!admin.breakGlass && !admin.hasPassword) {
    return 'Signs in only with single sign-on, so there is no password to fall back on.';
  }
  const last =
    admin.breakGlass &&
    policy.requireSso &&
    policy.breakGlassAdmins.every((entry) => entry.id === admin.id);
  return last ? 'The last break-glass admin stays while single sign-on is required.' : null;
}

function consequences({ admin, breakGlass }: Pending, requireSso: boolean): string[] {
  const told = 'Every other org admin is told about this change.';
  if (breakGlass) {
    return [
      `${admin.name} keeps signing in with a password while single sign-on is required, so they can get in if your identity provider is down.`,
      told,
    ];
  }
  return [
    requireSso
      ? `${admin.name} can no longer sign in with a password; they sign in with single sign-on like everyone else.`
      : `If you require single sign-on later, ${admin.name} won’t keep a password.`,
    told,
  ];
}

/**
 * Who keeps password sign-in while single sign-on is required: every org admin, each with Make
 * or Remove. The confirmation names the person; the last one cannot be removed while single
 * sign-on is required, and someone without a password cannot be made one.
 */
export function BreakGlassAdmins({ policy }: { policy: SsoPolicy }) {
  const breakGlass = useBreakGlass();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ask = (next: Pending | null) => {
    setError(null);
    breakGlass.reset();
    setPending(next);
  };
  const apply = async () => {
    if (!pending) return;
    setError(null);
    try {
      await breakGlass.set(pending.admin, pending.breakGlass);
      setPending(null);
    } catch (failure) {
      setError(describeError(failure).message);
    }
  };
  return (
    <div className="flex flex-col">
      <ul aria-label="Org admins" className="m-0 flex list-none flex-col p-0">
        {policy.admins.map((admin) => {
          const blocked = blockedReason(admin, policy);
          return (
            <li
              key={admin.id}
              className="flex flex-wrap items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0"
            >
              <Avatar name={admin.name} size={28} />
              <div className="flex min-w-48 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                  <b className="truncate text-13 font-medium text-tx">{admin.name}</b>
                  {admin.breakGlass ? <Badge tone="ok">Break-glass</Badge> : null}
                  {!admin.hasPassword ? <Badge>No password</Badge> : null}
                </span>
                <span className={`text-12 text-tx-3 ${blocked ? '' : 'truncate'}`}>
                  {blocked ?? admin.email}
                </span>
              </div>
              <Button
                size="sm"
                variant={admin.breakGlass ? 'ghost' : 'secondary'}
                disabled={blocked !== null}
                onClick={() => ask({ admin, breakGlass: !admin.breakGlass })}
              >
                {admin.breakGlass ? 'Remove…' : 'Make break-glass…'}
                <span className="sr-only">, {admin.name}</span>
              </Button>
            </li>
          );
        })}
      </ul>
      <ConfirmChange
        open={pending !== null}
        title={
          pending?.breakGlass
            ? `Make ${pending.admin.name} a break-glass admin?`
            : `Remove ${pending?.admin.name ?? 'this admin'} as a break-glass admin?`
        }
        consequences={pending ? consequences(pending, policy.requireSso) : []}
        confirmLabel={pending?.breakGlass ? 'Make break-glass admin' : 'Remove break-glass admin'}
        tone="caution"
        busy={breakGlass.saving}
        error={error}
        onConfirm={() => void apply()}
        onCancel={() => ask(null)}
      />
    </div>
  );
}
