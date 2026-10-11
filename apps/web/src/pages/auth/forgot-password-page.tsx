import { Button, Field, Input, Kbd } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link, useSearch } from '@tanstack/react-router';
import { AuthHeading, AuthShell, useAuthWorkspace } from '../../components/auth/auth-layout.tsx';
import { AuthAlt, AuthSmall } from '../../components/auth/auth-parts.tsx';
import { FormError } from '../../components/form.tsx';
import { clock } from '../../lib/auth-errors.ts';
import { useRequestResetForm } from '../../hooks/use-password-forms.ts';
import { useSsoSignIn } from '../../hooks/use-sso-sign-in.ts';

const BACK = (
  <AuthAlt>
    <Link to="/login">Back to sign in</Link>
  </AuthAlt>
);

/**
 * Forgot password: the email carried over from sign-in, a link that works for an hour, and a
 * resend once a minute has passed. It never says whether the address has an account.
 */
export function ForgotPasswordPage() {
  const { email } = useSearch({ from: '/forgot-password' });
  const form = useRequestResetForm(email ?? '');
  const { name } = useAuthWorkspace();
  const sso = useSsoSignIn();
  const workspace = name ?? 'this workspace';

  if (form.sent) {
    return (
      <AuthShell title="Check your email">
        <span className="grid size-11 place-items-center rounded-card bg-acc-50 text-acc">
          <Icon name="mail" size={22} />
        </span>
        <div role="status">
          <AuthHeading
            title="Check your email"
            lede={
              <>
                If <b className="font-semibold text-tx">{form.values.email}</b> has a password at{' '}
                {workspace}, a link to choose a new one is on its way. It works for one hour.
              </>
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button
            size="touch"
            block
            disabled={form.resendIn > 0}
            loading={form.mutation.isPending}
            onClick={form.resend}
          >
            Resend link
          </Button>
          <AuthSmall center>
            {form.resendIn > 0
              ? `You can resend in ${clock(form.resendIn)}. Check spam if nothing arrives.`
              : 'Nothing yet? Check spam, then resend.'}
          </AuthSmall>
        </div>
        <FormError error={form.mutation.error} />
        {BACK}
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password">
      <AuthHeading title="Reset your password" lede="We’ll email you a link to choose a new one." />
      <form className="flex flex-col gap-4" onSubmit={form.submit} noValidate>
        <Field
          label="Email"
          hint={email ? 'Carried over from sign-in.' : undefined}
          error={
            form.errors['email'] ? <span role="alert">{form.errors['email']}</span> : undefined
          }
        >
          <Input
            size="touch"
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoFocus
            value={form.values.email}
            onChange={(event) => form.set('email')(event.target.value)}
          />
        </Field>
        <FormError error={form.mutation.error} />
        <Button
          type="submit"
          variant="primary"
          size="touch"
          block
          loading={form.mutation.isPending}
          className="relative"
          iconEnd={
            form.mutation.isPending ? undefined : (
              <Kbd keys="Enter" className="absolute right-3 max-sm:hidden" />
            )
          }
        >
          Email me a link
        </Button>
      </form>
      {sso.options.length > 0 ? (
        <AuthSmall>
          Signing in with{' '}
          {sso.options.length === 1 ? sso.options[0]?.displayName : 'single sign-on'}? Your password
          lives there; reset it with your identity provider instead.
        </AuthSmall>
      ) : null}
      {BACK}
    </AuthShell>
  );
}
