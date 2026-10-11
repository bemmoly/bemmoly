import { Button, Field, Input } from '@bemmoly/ui';
import { Link, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { FormAlert, FormError } from '../../components/form.tsx';
import { OrDivider, SsoButtons } from '../../components/sso/sso-buttons.tsx';
import { useLoginForm } from '../../hooks/use-auth-forms.ts';
import { ssoFailureMessage, useSsoSignIn } from '../../hooks/use-sso-sign-in.ts';

function PasswordForm({ redirect }: { redirect: string | undefined }) {
  const form = useLoginForm(redirect);
  return (
    <form className="flex flex-col gap-3.5" onSubmit={form.submit} noValidate>
      <Field label="Email" error={form.errors['email']}>
        <Input
          size="lg"
          type="email"
          autoComplete="username"
          autoFocus
          value={form.values.email}
          onChange={(event) => form.set('email')(event.target.value)}
        />
      </Field>
      <Field label="Password" error={form.errors['password']}>
        <Input
          size="lg"
          type="password"
          autoComplete="current-password"
          value={form.values.password}
          onChange={(event) => form.set('password')(event.target.value)}
        />
      </Field>
      <FormError error={form.mutation.error} />
      <Button type="submit" variant="primary" size="lg" block disabled={form.mutation.isPending}>
        {form.mutation.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
      <Link to="/forgot-password" className="self-center text-13 font-medium">
        Forgot your password?
      </Link>
    </form>
  );
}

/**
 * Sign in: "Continue with SSO" first when an identity provider is set up, then the password
 * form. While single sign-on is required the password form folds away behind a quiet link for
 * break-glass admins. A single sign-on that did not finish comes back here with its reason.
 */
export function LoginPage() {
  const { redirect, sso_error: ssoError } = useSearch({ from: '/login' });
  const sso = useSsoSignIn();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const failure = ssoFailureMessage(ssoError);
  const hasSso = sso.options.length > 0;
  const passwordFolded = hasSso && sso.requireSso && !passwordOpen;
  return (
    <AuthLayout
      title="Sign in"
      subtitle={
        hasSso
          ? 'Sign in to your workspace with your work account.'
          : 'Sign in to your workspace with the email and password your admin set up for you.'
      }
    >
      {failure ? <FormAlert>{failure}</FormAlert> : null}
      {hasSso ? (
        <SsoButtons
          options={sso.options}
          primary={sso.requireSso}
          onStart={(id) => sso.start(id, redirect)}
        />
      ) : null}
      {passwordFolded ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => setPasswordOpen(true)}
        >
          Sign in with a password (break-glass admins)
        </Button>
      ) : (
        <>
          {hasSso ? <OrDivider /> : null}
          <PasswordForm redirect={redirect} />
        </>
      )}
    </AuthLayout>
  );
}
