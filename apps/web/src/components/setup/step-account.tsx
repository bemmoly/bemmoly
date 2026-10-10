import { Field, Input } from '@bemmoly/ui';
import { PASSWORD_HINT, useSetupAdmin } from '../../hooks/use-setup-admin.ts';
import { PasswordField } from './password-field.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

/**
 * The second step: the owner's name, email and password. Sending it creates the admin and the
 * workspace from the first step together; a refused workspace goes back to the first step.
 */
export function StepAccount({ nav }: { nav: StepNav }) {
  const form = useSetupAdmin(nav.next, nav.back);
  return (
    <StepForm label="Your account" onSubmit={form.submit} busy={form.mutation.isPending}>
      <div className="flex flex-col gap-4">
        <Field label="Your name" error={form.errors['name']}>
          <Input
            size="lg"
            autoFocus
            autoComplete="name"
            value={form.values.name}
            onChange={(event) => form.set('name')(event.target.value)}
            onBlur={form.blur('name')}
          />
        </Field>
        <Field label="Email" error={form.errors['email']}>
          <Input
            size="lg"
            type="email"
            autoComplete="username"
            spellCheck={false}
            value={form.values.email}
            onChange={(event) => form.set('email')(event.target.value)}
            onBlur={form.blur('email')}
          />
        </Field>
        <PasswordField
          value={form.values.password}
          error={form.errors['password']}
          hint={PASSWORD_HINT}
          onChange={form.set('password')}
          onBlur={form.blur('password')}
        />
      </div>
      <StepFooter
        nav={nav}
        loading={form.mutation.isPending}
        error={form.failed ? form.mutation.error : null}
      />
    </StepForm>
  );
}
