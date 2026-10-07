import { Link } from '@tanstack/react-router';
import { useFragmentToken } from '../../hooks/use-fragment-token.ts';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { BUTTON } from '../../components/button-sizes.ts';
import { Field, FormError, Notice } from '../../components/form.tsx';
import { useAcceptInvitation } from '../../hooks/use-auth-forms.ts';
import { describeError } from '../../lib/errors.ts';
import { Button, Input, Skeleton } from '../../ui.ts';

export function AcceptInvitationPage() {
  const token = useFragmentToken();
  const form = useAcceptInvitation(token);
  const { data: invitation, isPending, error } = form.invitation;
  if (token && isPending)
    return (
      <AuthLayout title="Checking your invitation">
        <Skeleton rows={3} />
      </AuthLayout>
    );
  if (!invitation) {
    const reason = token
      ? describeError(error).message
      : 'This link is incomplete. Open it from the invitation email again.';
    return (
      <AuthLayout title="This invitation cannot be used">
        <Notice tone="warn">{reason} Ask the person who invited you to send a new one.</Notice>
        <Link
          to="/login"
          search={{ redirect: undefined }}
          className="self-center text-small font-medium"
        >
          Go to sign in
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title={`Join ${invitation.workspaceName}`}
      subtitle={
        <>
          You were invited as <b className="font-medium text-tx">{invitation.email}</b> with the{' '}
          {invitation.roleName} role{invitation.teamName ? ` on ${invitation.teamName}` : ''}.
        </>
      }
    >
      <form className="flex flex-col gap-3.5" onSubmit={form.submit} noValidate>
        <Field label="Your name" error={form.errors['name']}>
          <Input
            autoComplete="name"
            autoFocus
            value={form.values.name}
            onChange={(event) => form.set('name')(event.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 12 characters." error={form.errors['password']}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.values.password}
            onChange={(event) => form.set('password')(event.target.value)}
          />
        </Field>
        <Field label="Type it again" error={form.errors['confirm']}>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.values.confirm}
            onChange={(event) => form.set('confirm')(event.target.value)}
          />
        </Field>
        <FormError error={form.mutation.error} />
        <Button
          type="submit"
          variant="primary"
          className={BUTTON.block}
          disabled={form.mutation.isPending}
        >
          Create account and join
        </Button>
      </form>
    </AuthLayout>
  );
}
