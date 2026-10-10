import { FIELD_KINDS } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Button, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useSettingsAccess } from '../../hooks/settings-access.ts';
import { useSchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { useFields } from '../../hooks/settings-schemes.ts';
import { useProject } from '../../shared/index.ts';
import { AddDialog } from './add-dialog.tsx';
import { FieldsTable, KINDS } from './fields-table.tsx';
import { SchemePage } from './scheme-page.tsx';

/**
 * Project settings › Fields: the custom fields issues of this project carry, from the org
 * default until the scheme is overridden; then they rename in place. Their order is set per
 * issue type, in its create-form layout, so this table has none of its own.
 */
export function FieldsPage({ projectKey }: { projectKey: string | undefined }) {
  const { project } = useProject(projectKey);
  const access = useSettingsAccess();
  const flow = useSchemeFlow(project?.id, 'fields');
  const fields = useFields(project?.id);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const overridden = flow.status?.overridden ?? false;
  const editable = overridden && access.configureProject;
  return (
    <SchemePage
      title="Fields"
      description="Custom fields on this project's issues. Which ones each type asks for, and which show on cards, is set per issue type."
      flow={flow}
      canConfigure={access.configureProject}
    >
      <div className="flex items-center gap-3">
        <p className="m-0 flex-1 text-12 text-tx-3">
          {editable ? 'Click a name to rename it.' : 'Override the scheme to rename or add fields.'}
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
