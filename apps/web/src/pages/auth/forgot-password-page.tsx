import { Link } from '@tanstack/react-router';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { FormError, Notice } from '../../components/form.tsx';
import { useRequestResetForm } from '../../hooks/use-auth-forms.ts';
import { Button, Input, Field } from '@bemmoly/ui';

export function ForgotPasswordPage() {
  const form = useRequestResetForm();
  const sent = form.mutation.isSuccess;
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email a link to choose a new one. It works for one hour."
    >
      {sent ? (
        <Notice>
          If {form.values.email} has an account here, a reset link is on its way. Check spam if it
          has not arrived in a few minutes.
        </Notice>
      ) : (
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
          <FormError error={form.mutation.error} />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            disabled={form.mutation.isPending}
          >
            Send reset link
          </Button>
        </form>
      )}
      <Link
        to="/login"
        search={{ redirect: undefined }}
        className="self-center text-12h font-medium"
      >
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
