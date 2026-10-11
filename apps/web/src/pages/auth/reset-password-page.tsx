import { Button, buttonClassName, Field, PasswordInput } from '@bemmoly/ui';
import { PASSWORD_MIN_LENGTH } from '@bemmoly/shared';
import { Link } from '@tanstack/react-router';
import { AuthHeading, AuthShell } from '../../components/auth/auth-layout.tsx';
import { AuthAlt, AuthNote, AuthSmall } from '../../components/auth/auth-parts.tsx';
import { FormError, Loading } from '../../components/form.tsx';
import { useFragmentToken } from '../../hooks/use-fragment-token.ts';
import { useResetPasswordForm } from '../../hooks/use-password-forms.ts';

function DeadLink({ incomplete }: { incomplete: boolean }) {
  return (
    <AuthShell title="This link can’t be used">
      <AuthHeading title="Reset your password" />
      <AuthNote
        tone="caution"
        icon="clock"
        title={incomplete ? 'This link is incomplete' : 'This link has expired'}
      >
        {incomplete
          ? 'Open the link from the reset email again, or ask for a new one.'
          : 'Reset links work for one hour, and only once. Ask for a new one; it takes a few seconds.'}
      </AuthNote>
      <Link
        to="/forgot-password"
        className={buttonClassName({ variant: 'primary', size: 'touch', block: true })}
      >
        Email me a new link
      </Link>
      <AuthAlt>
        <Link to="/login">Back to sign in</Link>
      </AuthAlt>
    </AuthShell>
  );
}

/**
 * Choose a new password: says whose account it is, takes one field (show or hide stands in for
 * typing it twice), and saving it signs in on this browser.
 */
export function ResetPasswordPage() {
  const token = useFragmentToken();
  const form = useResetPasswordForm(token);
  if (!token) return <DeadLink incomplete />;
  if (form.account.isPending) {
    return (
      <AuthShell title="Choose a new password">
        <Loading label="Checking your link" lines={3} />
      </AuthShell>
    );
  }
  if (!form.account.data) return <DeadLink incomplete={false} />;
  const email = form.account.data.email;
  const short =
    form.values.password.length > 0 && form.values.password.length < PASSWORD_MIN_LENGTH;
  return (
    <AuthShell title="Choose a new password">
      <AuthHeading
        title="Choose a new password"
        lede={
          <>
            For <b className="font-semibold text-tx">{email}</b>. You’ll be signed in when it’s
            saved.
          </>
        }
      />
      <form className="flex flex-col gap-4" onSubmit={form.submit} noValidate>
        {/* The account's name, for password managers: they save the new password against it. */}
        <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
        <Field
          label="New password"
          hint={
            short
              ? `Use at least ${PASSWORD_MIN_LENGTH} characters, ${PASSWORD_MIN_LENGTH - form.values.password.length} to go.`
              : `At least ${PASSWORD_MIN_LENGTH} characters.`
          }
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
            autoFocus
            readOnly={form.mutation.isPending}
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
          Save password and sign in
        </Button>
      </form>
      <AuthSmall>Saving signs out every other device that used the old password.</AuthSmall>
    </AuthShell>
  );
}
