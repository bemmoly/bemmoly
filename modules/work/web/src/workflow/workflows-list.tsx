import { formatRelative } from '@bemmoly/core-web';
import {
  Badge,
  EmptyState,
  PageTitle,
  SettingsContent,
  SettingsFrame,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { Project, Workflow } from '../../../shared/index.ts';
import { useWorkflowUsage } from '../hooks/workflow-usage.ts';
import { navigate } from './navigate.ts';

interface Row {
  workflow: Workflow;
  using: Project[];
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function columns(projectId: string): TableColumn<Row>[] {
  return [
    {
      key: 'name',
      header: 'Workflow',
      width: 'minmax(0,1fr)',
      render: ({ workflow }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-tx" title={workflow.name}>
            {workflow.name}
          </span>
          <span className="shrink-0 text-12 text-tx-3">
            {workflow.projectId ? 'This project' : 'Default'}
          </span>
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '100px',
      render: ({ workflow }) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-12 tabular-nums">
            {workflow.publishedVersion > 0 ? `v${workflow.publishedVersion}` : 'Unpublished'}
          </span>
          {workflow.hasDraft && <Badge tone="amber">Draft</Badge>}
        </span>
      ),
    },
    {
      key: 'projects',
      header: 'Projects using it',
      width: '200px',
      hideOnPhone: true,
      render: ({ using }) => (
        <span
          className="flex min-w-0 items-center gap-2 text-tx-2"
          title={using.map((project) => project.name).join(', ')}
        >
          {using.some((project) => project.id === projectId) && (
            <span className="size-1.5 shrink-0 rounded-full bg-acc" aria-label="Runs here" />
          )}
          <span className="truncate">
            {using.length === 0
              ? 'None'
              : using.length <= 2
                ? using.map((project) => project.key).join(', ')
                : plural(using.length, 'project')}
          </span>
        </span>
      ),
    },
    {
      key: 'published',
      header: 'Published',
      width: '110px',
      hideOnPhone: true,
      render: ({ workflow }) => (
        <span className="text-tx-3">
          {workflow.publishedAt ? formatRelative(workflow.publishedAt) : 'Never'}
        </span>
      ),
    },
  ];
}

/**
 * Project settings › Workflow: the default and the project's own copy, each with its
 * published version and who runs it (a dot marks the one this project runs); a row, or
 * Enter on it, opens the editor.
 */
export function WorkflowsList({
  project,
  editorPath,
}: {
  project: Project;
  editorPath: (workflowId: string) => string;
}) {
  const { workflows, usage, isPending, error } = useWorkflowUsage();
  const rows = workflows
    .filter((workflow) => workflow.projectId === null || workflow.projectId === project.id)
    .map((workflow) => ({ workflow, using: usage(workflow) }));
  return (
    <SettingsFrame nav={null}>
      <SettingsContent width="narrow">
        <PageTitle
          variant="settings"
          title="Workflow"
          description="Statuses and the moves between them. A project runs its own copy when it has one, and the default otherwise. Open one to edit a draft; publishing shows what changes first."
        />
        {isPending ? (
          <TableSkeleton
            label="Loading workflows"
            rows={2}
            columns={[
              { width: 'minmax(0,1fr)' },
              { width: '100px' },
              { width: '200px' },
              { width: '110px' },
            ]}
          />
        ) : error ? (
          <EmptyState
            icon={<Icon name="alert" />}
            title="Workflows did not load"
            description="Reload the page to try again."
          />
        ) : (
          <Table
            label="Workflows"
            columns={columns(project.id)}
            rows={rows}
            rowKey={(row) => row.workflow.id}
            onRowClick={(row) => navigate(editorPath(row.workflow.id))}
            empty={
              <EmptyState
                icon={<Icon name="workflow" />}
                title="No workflows yet"
                description="The org default appears here once Work is set up."
              />
            }
          />
        )}
      </SettingsContent>
    </SettingsFrame>
  );
}
