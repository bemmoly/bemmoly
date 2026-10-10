import { ISSUE_TYPE_LEVELS } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { Button, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import { useSettingsAccess } from '../../hooks/settings-access.ts';
import { useSchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { useIssueTypes } from '../../hooks/settings-schemes.ts';
import { useProject } from '../../shared/index.ts';
import { AddDialog } from './add-dialog.tsx';
import { IssueTypesTable, LEVELS } from './issue-types-table.tsx';
import { SchemePage } from './scheme-page.tsx';

/**
 * Project settings › Issue types: the types the project offers, from the org default until
 * it is overridden. Once it is, they rename in place and reorder by drag or keyboard.
 */
export function IssueTypesPage({ projectKey }: { projectKey: string | undefined }) {
  const { project } = useProject(projectKey);
  const access = useSettingsAccess();
  const flow = useSchemeFlow(project?.id, 'issue_types');
  const types = useIssueTypes(project?.id);
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const overridden = flow.status?.overridden ?? false;
  const editable = overridden && access.configureProject;
  const rows = types.list.data ?? [];
  const failed = (title: string) => (error: Error) =>
    toast.show({ tone: 'danger', title, body: error.message });
  return (
    <SchemePage
      title="Issue types"
      description="The kinds of work this project tracks and how they nest: Epic › Story, Bug, Task, Incident › Subtask."
      flow={flow}
      canConfigure={access.configureProject}
    >
      <div className="flex items-center gap-3">
        <p className="m-0 flex-1 text-12 text-tx-3">
          {editable
            ? 'Click a name to rename it. Drag a row, or use ↑↓ on its grip, to change the order pickers show.'
            : 'Override the scheme to rename, reorder or add types.'}
        </p>
        {editable && (
          <Button size="xs" icon={<Icon name="plus" size={14} />} onClick={() => setAdding(true)}>
            Add issue type
          </Button>
        )}
      </div>
      <IssueTypesTable
        rows={rows}
        loading={types.list.isPending}
        editable={editable}
        onRename={(type, name) =>
          types.update.mutate(
            { typeId: type.id, body: { name } },
            { onError: failed(`${type.name} was not renamed`) },
          )
        }
        onMove={(from, to) => {
          const ids = rows.map((row) => row.id);
          const [moved] = ids.splice(from, 1);
          if (!moved) return;
          ids.splice(to, 0, moved);
          types.reorder.mutate(ids, { onError: failed('The new order was not saved') });
        }}
      />
      <AddDialog
        open={adding}
        title="Add an issue type"
        choiceLabel="Level"
        choices={ISSUE_TYPE_LEVELS.map((level) => ({ value: level, label: LEVELS[level] }))}
        initialChoice="standard"
        busy={types.create.isPending}
        error={types.create.error}
        confirmLabel="Add issue type"
        onClose={() => setAdding(false)}
        onSubmit={({ name, key, choice }) =>
          types.create.mutate({ name, key, level: choice }, { onSuccess: () => setAdding(false) })
        }
      />
    </SchemePage>
  );
}
