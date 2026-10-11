import { Link } from '@tanstack/react-router';
import { useFragmentToken } from '../../hooks/use-fragment-token.ts';
import { AuthLayout } from '../../components/auth/auth-layout.tsx';
import { FormError, Notice } from '../../components/form.tsx';
import { useResetPasswordForm } from '../../hooks/use-auth-forms.ts';
import { Button, Input, Field } from '@bemmoly/ui';

export function ResetPasswordPage() {
  const token = useFragmentToken();
  const form = useResetPasswordForm(token);
  if (!token) {
    return (
      <AuthLayout title="This link is incomplete">
        <Notice tone="caution">
          Open the link from the reset email again, or ask for a new one.
        </Notice>
        <Link to="/forgot-password" className="self-center text-13 font-medium">
          Ask for a new link
        </Link>
      </AuthLayout>
    );
  }
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="At least 12 characters. You'll sign in with it next."
    >
      <form className="flex flex-col gap-3.5" onSubmit={form.submit} noValidate>
        <Field label="New password" error={form.errors['password']}>
          <Input
            size="lg"
            type="password"
            autoComplete="new-password"
            autoFocus
            value={form.values.password}
            onChange={(event) => form.set('password')(event.target.value)}
          />
        </Field>
        <Field label="Type it again" error={form.errors['confirm']}>
          <Input
            size="lg"
            type="password"
            autoComplete="new-password"
            value={form.values.confirm}
            onChange={(event) => form.set('confirm')(event.target.value)}
          />
        </Field>
        <FormError error={form.mutation.error} />
        <Button type="submit" variant="primary" size="lg" block disabled={form.mutation.isPending}>
          Save password and sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
