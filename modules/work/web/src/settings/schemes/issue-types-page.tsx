import { ISSUE_TYPE_LEVELS, type IssueTypeLevel } from '@bemmoly/module-work/shared';
import { Badge, Button, SettingsSection, Skeleton, TypeGlyph } from '@bemmoly/ui';
import { useState, type ReactNode } from 'react';
import { useSettingsAccess } from '../../hooks/settings-access.ts';
import { useSchemeFlow } from '../../hooks/settings-scheme-flow.ts';
import { useIssueTypes } from '../../hooks/settings-schemes.ts';
import { useProject } from '../../shared/index.ts';
import { AddDialog } from './add-dialog.tsx';
import { SchemePage } from './scheme-page.tsx';

const LEVELS: Record<IssueTypeLevel, string> = {
  epic: 'Epic level',
  standard: 'Standard',
  subtask: 'Subtask level',
};

/**
 * Project settings › Issue types: the types the project offers, from the org
 * default until it is overridden, with a project's own types marked as the
 * Workflow mock's type list marks them.
 */
export function IssueTypesPage({
  projectKey,
  nav,
}: {
  projectKey: string | undefined;
  nav: ReactNode;
}) {
  const { project } = useProject(projectKey);
  const access = useSettingsAccess();
  const flow = useSchemeFlow(project?.id, 'issue_types');
  const types = useIssueTypes(project?.id);
  const [adding, setAdding] = useState(false);
  const overridden = flow.status?.overridden ?? false;
  return (
    <SchemePage
      project={project}
      title="Issue types"
      description="The kinds of work this project tracks and how they nest: Epic › Story, Bug, Task, Incident › Subtask."
      flow={flow}
      canConfigure={access.configureProject}
      nav={nav}
    >
      <SettingsSection
        title="Issue types"
        hint={overridden ? undefined : 'Override the scheme to change them'}
        layout="rows"
        actions={
          overridden && access.configureProject ? (
            <Button size="xs" onClick={() => setAdding(true)}>
              + Add
            </Button>
          ) : undefined
        }
      >
        {types.list.isPending && <Skeleton className="my-2 h-20" />}
        {(types.list.data ?? []).map((type) => {
          return (
            <div
              key={type.id}
              className="flex items-center gap-2.5 border-b border-br-row py-2.25 last:border-b-0"
            >
              <TypeGlyph type={type} size={18} />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="font-semibold">{type.name}</span>
                <span className="text-11h text-tx5">{type.description ?? LEVELS[type.level]}</span>
              </span>
              <span className="text-12 text-tx5">{LEVELS[type.level]}</span>
              {type.projectId && !type.originId && <Badge tone="accent">PROJECT</Badge>}
            </div>
          );
        })}
      </SettingsSection>
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
