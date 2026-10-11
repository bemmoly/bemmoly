import { FIELD_KINDS } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Button, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { NO_ORG_PERMISSION, useSettingsAccess } from '../../hooks/settings-access.ts';
import { useSchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { useFields } from '../../hooks/settings-schemes.ts';
import { useAiEnabled } from '../../issue/issue-ai-summary.tsx';
import { useProject } from '../../shared/index.ts';
import { orgSettingsPath, type SettingsScope } from '../pages.ts';
import { AddDialog } from './add-dialog.tsx';
import { FieldsTable, KINDS } from './fields-table.tsx';
import { SchemePage } from './scheme-page.tsx';

/**
 * Fields, in a project or as the org default: the custom fields issues carry, from the org
 * default until a project overrides the scheme; then they rename in place. Their order is set
 * per issue type, in its create-form layout, so this table has none of its own.
 */
export function FieldsPage({ scope }: { scope: SettingsScope }) {
  const org = scope.kind === 'org';
  const { project } = useProject(org ? undefined : scope.projectKey);
  const access = useSettingsAccess();
  const flow = useSchemeFlow(org ? undefined : project?.id, 'fields');
  const fields = useFields(org ? null : project?.id);
  const aiEnabled = useAiEnabled();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const overridden = flow.status?.overridden ?? false;
  const editable = org ? access.orgAdmin : overridden && access.configureProject;
  const locked = org ? NO_ORG_PERMISSION : 'Override the scheme to rename or add fields.';
  return (
    <SchemePage
      title="Fields"
      description={
        org
          ? 'Custom fields every project carries until it overrides them. Which ones each type asks for, and which show on cards, is set per issue type.'
          : "Custom fields on this project's issues. Which ones each type asks for, and which show on cards, is set per issue type."
      }
      kind="fields"
      flow={org ? null : flow}
      canConfigure={org ? access.orgAdmin : access.configureProject}
      defaultHref={access.orgAdmin ? orgSettingsPath('fields') : undefined}
    >
      <div className="flex items-center gap-3">
        <p className="m-0 flex-1 text-12 text-tx-3">
          {editable ? 'Click a name to rename it.' : locked}
        </p>
        {editable && (
          <Button size="xs" icon={<Icon name="plus" size={14} />} onClick={() => setAdding(true)}>
            Create custom field
          </Button>
        )}
      </div>
      <FieldsTable
        rows={fields.list.data ?? []}
        loading={fields.list.isPending}
        editable={editable}
        aiEnabled={aiEnabled}
        onRename={(field, name) =>
          fields.update.mutate(
            { fieldId: field.id, body: { name } },
            {
              onError: (error) =>
                toast.show({
                  tone: 'danger',
                  title: `${field.name} was not renamed`,
                  body: error.message,
                }),
            },
          )
        }
      />
      <AddDialog
        open={adding}
        title="Create a custom field"
        choiceLabel="Kind"
        choices={FIELD_KINDS.map((kind) => ({ value: kind, label: KINDS[kind] }))}
        initialChoice="text"
        busy={fields.create.isPending}
        error={fields.create.error}
        confirmLabel="Create field"
        onClose={() => setAdding(false)}
        onSubmit={({ name, key, choice }) =>
          fields.create.mutate({ name, key, kind: choice }, { onSuccess: () => setAdding(false) })
        }
      />
    </SchemePage>
  );
}
