import { formatRelative } from '@bemmoly/core-web';
import { Badge, Breadcrumbs, EmptyState, Skeleton, Table, type TableColumn } from '@bemmoly/ui';
import type { Project, Workflow } from '../../../shared/index.ts';
import { useWorkflowUsage } from '../hooks/workflow-usage.ts';
import { navigate } from './navigate.ts';

interface Row {
  workflow: Workflow;
  using: Project[];
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function columns(): TableColumn<Row>[] {
  return [
    {
      key: 'name',
      header: 'Workflow',
      width: 'minmax(0,1fr)',
      render: ({ workflow }) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-tx">{workflow.name}</span>
          <Badge tone={workflow.projectId ? 'accent' : 'neutral'}>
            {workflow.projectId ? 'PROJECT COPY' : 'ORG DEFAULT'}
          </Badge>
        </span>
      ),
    },
    {
      key: 'version',
      header: 'Version',
      width: '150px',
      render: ({ workflow }) => (
        <span className="flex items-center gap-2">
          <span className="font-mono text-12">
            {workflow.publishedVersion > 0 ? `v${workflow.publishedVersion}` : 'Unpublished'}
          </span>
          {workflow.hasDraft && <Badge tone="amber">DRAFT</Badge>}
        </span>
      ),
    },
    {
      key: 'projects',
      header: 'Projects using it',
      width: '200px',
      render: ({ using }) => (
        <span className="truncate text-tx3" title={using.map((project) => project.name).join(', ')}>
          {using.length === 0
            ? 'None'
            : using.length <= 2
              ? using.map((project) => project.key).join(', ')
              : plural(using.length, 'project')}
        </span>
      ),
    },
    {
      key: 'changed',
      header: 'Last change',
      width: '130px',
      render: ({ workflow }) => (
        <span className="text-tx4">{formatRelative(workflow.updatedAt)}</span>
      ),
    },
  ];
}

/**
 * Work settings › Workflows: the org defaults and the project's own copy,
 * each with its published version and who runs it; a row opens the editor.
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
    <div className="flex max-w-240 flex-col gap-5 px-6 pt-3.5 pb-12">
      <div className="flex flex-col gap-3">
        <Breadcrumbs
          items={[
            { label: 'Projects' },
            { label: project.name },
            { label: 'Settings' },
            { label: 'Workflows' },
          ]}
        />
        <div className="flex flex-col gap-1">
          <h1 className="m-0 text-22 font-semibold tracking-title">Workflows</h1>
          <p className="m-0 text-12h text-tx4">
            Statuses and the transitions between them. A project runs its own copy when it has one,
            and the org default otherwise.
          </p>
        </div>
      </div>
      {isPending ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <EmptyState title="Workflows did not load" description="Reload the page to try again." />
      ) : (
        <Table
          label="Workflows"
          columns={columns()}
          rows={rows}
          rowKey={(row) => row.workflow.id}
          onRowClick={(row) => navigate(editorPath(row.workflow.id))}
          empty={
            <EmptyState
              title="No workflows yet"
              description="The org default appears here once Work is set up."
            />
          }
        />
      )}
    </div>
  );
}
