import { PASSWORD_MIN_LENGTH } from '@bemmoly/shared';
import { Avatar, Button, Field, Input, PasswordInput } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { AuthHeading, AuthShell } from '../../components/auth/auth-layout.tsx';
import { AuthAlt, AuthNote, AuthSmall } from '../../components/auth/auth-parts.tsx';
import { FormError, Loading } from '../../components/form.tsx';
import { SsoButtons } from '../../components/sso/sso-buttons.tsx';
import { useFragmentToken } from '../../hooks/use-fragment-token.ts';
import { useAcceptInvitation } from '../../hooks/use-password-forms.ts';
import { useSsoSignIn } from '../../hooks/use-sso-sign-in.ts';
import { describeError } from '../../lib/errors.ts';

/**
 * Join the workspace from an invitation. When single sign-on is set up the invitation is
 * accepted through the identity provider only, with no new password; otherwise a name and a
 * password, with the email fixed by the invitation.
 */
export function AcceptInvitationPage() {
  const token = useFragmentToken();
  const form = useAcceptInvitation(token);
  const sso = useSsoSignIn();
  const { data: invitation, isPending, error } = form.invitation;
  if (token && (isPending || sso.query.isPending)) {
    return (
      <AuthShell title="Checking your invitation">
        <Loading label="Checking your invitation" lines={3} />
      </AuthShell>
    );
  }
  if (!invitation) {
    const reason = token
      ? describeError(error).message
      : 'This link is incomplete. Open it from the invitation email again.';
    return (
      <AuthShell title="This invitation can’t be used">
        <AuthHeading title="Join the workspace" />
        <AuthNote tone="caution" icon="mail" title="This invitation can’t be used">
          {reason} Ask the person who invited you to send a new one from Settings › People.
        </AuthNote>
        <AuthAlt>
          Already joined? <Link to="/login">Sign in</Link>
        </AuthAlt>
      </AuthShell>
    );
  }
  const workspace = invitation.workspaceName;
  const inviter = invitation.inviterName ?? 'An admin';
  const viaSso = sso.options.length > 0;
  return (
    <AuthShell title={`Join ${workspace}`} workspaceName={workspace}>
      <AuthHeading title={`Join ${workspace}`} />
      <div className="flex items-center gap-3 rounded-card bg-acc-50 px-3.5 py-3">
        <Avatar name={inviter} size={28} />
        <p className="m-0 text-14 text-tx-2">
          <b className="font-semibold text-tx">{inviter}</b> invited you to{' '}
          <b className="font-semibold text-tx">{workspace}</b> as {invitation.roleName}
          {invitation.teamName ? ` on ${invitation.teamName}` : ''}.
        </p>
      </div>
      {viaSso ? (
        <>
          <SsoButtons options={sso.options} only autoFocus onStart={(id) => sso.start(id, '/')} />
          <AuthSmall>
            Use the work account for {invitation.email}. No new password needed.
          </AuthSmall>
        </>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={form.submit} noValidate>
          <Field label="Email" hint="From the invitation. You’ll sign in with it.">
            <Input
              size="touch"
              type="email"
              name="email"
              autoComplete="username"
              value={invitation.email}
              readOnly
              suffix={<Icon name="lock" size={14} className="text-tx-3" />}
            />
          </Field>
          <Field
            label="Your name"
            error={
              form.errors['name'] ? <span role="alert">{form.errors['name']}</span> : undefined
            }
          >
            <Input
              size="touch"
              name="name"
              autoComplete="name"
              autoFocus
              value={form.values.name}
              onChange={(event) => form.set('name')(event.target.value)}
            />
          </Field>
          <Field
            label="Password"
            hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
            error={
              form.errors['password'] ? (
                <span role="alert">{form.errors['password']}</span>
              ) : undefined
            }
          >
            <PasswordInput
              autoComplete="new-password"
              meter
              minLength={PASSWORD_MIN_LENGTH}
              value={form.values.password}
              onChange={(event) => form.set('password')(event.target.value)}
            />
          </Field>
          <FormError error={form.mutation.error} />
          <Button
            type="submit"
            variant="primary"
            size="touch"
            block
            loading={form.mutation.isPending}
          >
            Join {workspace}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
