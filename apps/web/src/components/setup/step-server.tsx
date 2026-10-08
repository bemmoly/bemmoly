import { Card, Field, Input } from '@bemmoly/ui';
import { PASSWORD_HINT, URL_HINT, useSetupAdmin } from '../../hooks/use-setup-admin.ts';
import type { HealthRow } from '../../hooks/use-setup-health.ts';
import { FormError, Notice } from '../form.tsx';
import { FormGroup } from './form-group.tsx';
import { HealthList } from './health-list.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

const FORM_ID = 'setup-admin';

const WORKSPACE_GROUP = {
  label: 'Workspace',
  description: 'The name and address your team will see.',
};
const ACCOUNT_GROUP = {
  label: 'Your account',
  description: 'How you sign in as the workspace owner.',
};

function AdminForm({ nav }: { nav: StepNav }) {
  const { values, errors, set, submit, mutation } = useSetupAdmin(nav.next);
  const fieldError = Object.values(errors).some(Boolean);
  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate aria-label="First admin account">
        <Card className="flex flex-col divide-y divide-br2">
          <FormGroup {...WORKSPACE_GROUP}>
            <Field label="Workspace name" error={errors['workspaceName']}>
              <Input
                size="lg"
                autoFocus
                value={values.workspaceName}
                onChange={(event) => set('workspaceName')(event.target.value)}
              />
            </Field>
            <Field label="URL" hint={URL_HINT} error={errors['workspaceUrl']}>
              <Input
                size="lg"
                mono
                tone="recessed"
                type="url"
                value={values.workspaceUrl}
                onChange={(event) => set('workspaceUrl')(event.target.value)}
              />
            </Field>
          </FormGroup>
          <FormGroup {...ACCOUNT_GROUP}>
            <Field label="Your name" error={errors['name']}>
              <Input
                size="lg"
                autoComplete="name"
                value={values.name}
                onChange={(event) => set('name')(event.target.value)}
              />
            </Field>
            <Field label="Email" error={errors['email']}>
              <Input
                size="lg"
                type="email"
                autoComplete="username"
                value={values.email}
                onChange={(event) => set('email')(event.target.value)}
              />
            </Field>
            <Field label="Password" hint={PASSWORD_HINT} error={errors['password']}>
              <Input
                size="lg"
                type="password"
                autoComplete="new-password"
                value={values.password}
                onChange={(event) => set('password')(event.target.value)}
              />
            </Field>
          </FormGroup>
        </Card>
      </form>
      {fieldError ? null : <FormError error={mutation.error} />}
      <StepFooter nav={nav} form={FORM_ID} loading={mutation.isPending} />
    </>
  );
}

interface StepServerProps {
  nav: StepNav;
  adminExists: boolean;
  rows: readonly HealthRow[];
}

/** Step 1: the health checks, then the first admin, or a note that it already exists. */
export function StepServer({ nav, adminExists, rows }: StepServerProps) {
  return (
    <>
      <HealthList rows={rows} />
      {adminExists ? (
        <>
          <Notice>Admin account created. You are signed in as the workspace owner.</Notice>
          <StepFooter nav={nav} label="Continue" onPrimary={nav.next} />
        </>
      ) : (
        <AdminForm nav={nav} />
      )}
    </>
  );
}
