import { FIELD_KINDS, type FieldKind } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Badge, Button, SettingsSection, Skeleton } from '@bemmoly/ui';
import { useState } from 'react';
import { useSettingsAccess } from '../../hooks/settings-access.ts';
import { useSchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { useFields } from '../../hooks/settings-schemes.ts';
import { useProject } from '../../shared/index.ts';
import { AddDialog } from './add-dialog.tsx';
import { SchemePage } from './scheme-page.tsx';

/** The field kind in the mono words of the Workflow mock's fields table. */
const KINDS: Record<FieldKind, string> = {
  text: 'text',
  richtext: 'rich text',
  number: 'number',
  select: 'select',
  multiselect: 'multi-select',
  user: 'person',
  date: 'date',
  datetime: 'date and time',
  url: 'link',
  doc: 'doc',
};

/**
 * Project settings › Fields: the custom fields issues of this project carry,
 * from the org default until the scheme is overridden. Fields added here are
 * the project's own and are marked PROJECT.
 */
export function FieldsPage({
  projectKey,
}: {
  projectKey: string | undefined;
}) {
  const { project } = useProject(projectKey);
  const access = useSettingsAccess();
  const flow = useSchemeFlow(project?.id, 'fields');
  const fields = useFields(project?.id);
  const [adding, setAdding] = useState(false);
  const overridden = flow.status?.overridden ?? false;
  return (
    <SchemePage
      title="Fields"
      description="Custom fields on this project's issues. Which ones each type asks for, and which show on cards, is set per issue type."
      flow={flow}
      canConfigure={access.configureProject}
    >
      <SettingsSection
        title="Custom fields"
        hint={overridden ? undefined : 'Override the scheme to change them'}
        layout="rows"
        actions={
          overridden && access.configureProject ? (
            <Button size="xs" onClick={() => setAdding(true)}>
              <Icon name="plus" size={14} />
              Create custom field
            </Button>
          ) : undefined
        }
      >
        {fields.list.isPending && <Skeleton className="my-2 h-20" />}
        {fields.list.data?.length === 0 && (
          <p className="m-0 py-2.5 text-tx4">No custom fields yet.</p>
        )}
        {(fields.list.data ?? []).map((field) => (
          <div
            key={field.id}
            className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2.5 border-b border-br-row py-2.25 last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-1.5 font-medium">
              {field.name}
              {field.aiFill && (
                <Badge tone="accent" className="px-1.5 py-px text-10h">
                  AI-FILLED
                </Badge>
              )}
              {field.projectId && !field.originId && (
                <Badge tone="accent" className="px-1.5 py-px text-10h">
                  PROJECT
                </Badge>
              )}
            </span>
            <span className="font-mono text-12 text-tx3">{KINDS[field.kind]}</span>
            <span className="text-12 text-tx5">
              {field.options.length > 0 ? `${field.options.length} options` : ''}
              {field.filterable ? (field.options.length > 0 ? ' · filterable' : 'filterable') : ''}
            </span>
          </div>
        ))}
      </SettingsSection>
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
