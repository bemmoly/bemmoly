import { Link, useSearch } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { FormError } from '../../components/form.tsx';
import { useLoginForm } from '../../hooks/use-auth-forms.ts';
import { Button, Input, Field } from '@bemmoly/ui';

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' });
  const form = useLoginForm(redirect);
  return (
    <AuthLayout title="Sign in" subtitle="Use the email and password your admin set up for you.">
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
        <Link to="/forgot-password" className="self-center text-12h font-medium">
          Forgot your password?
        </Link>
      </form>
    </AuthLayout>
  );
}
