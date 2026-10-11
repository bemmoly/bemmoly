import { Field, Input } from '@bemmoly/ui';
import { URL_HINT, useSetupWorkspace } from '../../hooks/use-setup-admin.ts';
import type { HealthRow } from '../../hooks/use-setup-health.ts';
import { HealthSummary } from './health-list.tsx';
import { SidebarPreview } from './sidebar-preview.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

interface StepWorkspaceProps {
  nav: StepNav;
  rows: readonly HealthRow[];
}

/**
 * The first step, after the welcome: the server's health in one line, then the workspace's
 * name and address beside a live preview of the sidebar they will read in.
 */
export function StepWorkspace({ nav, rows }: StepWorkspaceProps) {
  const form = useSetupWorkspace(nav.next);
  const name = form.values.workspaceName.trim();
  return (
    <StepForm label="Workspace" onSubmit={form.submit}>
      <HealthSummary rows={rows} />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_216px]">
        <div className="flex flex-col gap-4">
          <Field label="Workspace name" error={form.errors['workspaceName']}>
            <Input
              size="lg"
              autoFocus
              autoComplete="organization"
              value={form.values.workspaceName}
              onChange={(event) => form.set('workspaceName')(event.target.value)}
              onBlur={form.blur('workspaceName')}
            />
          </Field>
          <Field label="URL" hint={URL_HINT} error={form.errors['workspaceUrl']}>
            <Input
              size="lg"
              mono
              type="url"
              inputMode="url"
              spellCheck={false}
              value={form.values.workspaceUrl}
              onChange={(event) => form.set('workspaceUrl')(event.target.value)}
              onBlur={form.blur('workspaceUrl')}
            />
          </Field>
        </div>
        <SidebarPreview
          workspaceName={name || 'Your workspace'}
          rows={3}
          caption="Your sidebar, as your team will see it."
        />
      </div>
      <StepFooter nav={nav} />
    </StepForm>
  );
}
