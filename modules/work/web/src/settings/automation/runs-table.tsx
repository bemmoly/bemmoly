import type { AutomationRun } from '@bemmoly/module-work/shared';
import {
  Button,
  EmptyState,
  KeyChip,
  RelativeTime,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { linkTo, workPaths } from '../../hooks/issue-navigation.ts';
import { durationLabel, outcomeLabel, runTriggerLabel } from './describe.ts';
import { RunState } from './run-state.tsx';
import type { useAutomationRuns } from './use-automation-runs.ts';

const WIDTHS = [
  '104px',
  'minmax(0,1.8fr)',
  'minmax(0,0.9fr)',
  '88px',
  '52px',
  'minmax(0,0.9fr)',
  '72px',
  '88px',
];

/** The run's issue, opened in place; a click on it never also opens the run. */
function IssueLink({ issueKey }: { issueKey: string }) {
  const link = linkTo(workPaths.issue(issueKey));
  return (
    <KeyChip
      issueKey={issueKey}
      size="md"
      href={link.href}
      aria-label={`Open ${issueKey}`}
      onClick={(event) => {
        event.stopPropagation();
        link.onClick(event);
      }}
    />
  );
}

interface RunsTableProps {
  runs: ReturnType<typeof useAutomationRuns>;
}

/** The run log: how each run went, for which rule, why, on which issue, and what it did. */
export function RunsTable({ runs }: RunsTableProps) {
  const columns: TableColumn<AutomationRun>[] = [
    {
      key: 'state',
      header: 'State',
      width: WIDTHS[0]!,
      render: (run) => <RunState status={run.status} />,
    },
    {
      key: 'rule',
      header: 'Rule',
      width: WIDTHS[1]!,
      render: (run) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{run.ruleName}</span>
          {run.error ? (
            <span
              className={`truncate text-12 ${run.status === 'failed' ? 'text-red-tx' : 'text-tx-3'}`}
            >
              {run.error}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger',
      width: WIDTHS[2]!,
      hideOnPhone: true,
      render: (run) => (
        <span className="block truncate text-tx-2">{runTriggerLabel(run.trigger)}</span>
      ),
    },
    {
      key: 'issue',
      header: 'Issue',
      width: WIDTHS[3]!,
      render: (run) =>
        run.issueKey ? (
          <IssueLink issueKey={run.issueKey} />
        ) : (
          <span className="text-tx-3">None</span>
        ),
    },
    {
      key: 'depth',
      header: 'Depth',
      width: WIDTHS[4]!,
      hideOnPhone: true,
      align: 'end',
      render: (run) => <span className="tabular-nums text-tx-2">{run.depth}</span>,
    },
    {
      key: 'outcome',
      header: 'Actions',
      width: WIDTHS[5]!,
      hideOnPhone: true,
      render: (run) => <span className="block truncate text-tx-2">{outcomeLabel(run) ?? ''}</span>,
    },
    {
      key: 'duration',
      header: 'Duration',
      width: WIDTHS[6]!,
      hideOnPhone: true,
      render: (run) => (
        <span className="tabular-nums text-tx-2">{durationLabel(run.durationMs) ?? ''}</span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      width: WIDTHS[7]!,
      hideOnPhone: true,
      render: (run) => <RelativeTime iso={run.createdAt} className="text-tx-2" />,
    },
  ];
  if (runs.log.isPending) {
    return (
      <TableSkeleton label="Loading runs" rows={5} columns={WIDTHS.map((width) => ({ width }))} />
    );
  }
  const filtered = runs.status !== 'all';
  return (
    <Table
      label="Run log"
      density="sm"
      columns={columns}
      rows={runs.runs}
      rowKey={(run) => run.id}
      selectedKey={runs.openId ?? undefined}
      onRowClick={runs.setOpen}
      footer={{
        hasMore: runs.log.hasNextPage,
        loading: runs.log.isFetchingNextPage,
        onLoadMore: () => void runs.log.fetchNextPage(),
      }}
      empty={
        filtered ? (
          <EmptyState
            size="sm"
            title="No runs in this state"
            action={<Button onClick={() => runs.setStatus('all')}>Clear filter</Button>}
          />
        ) : (
          <EmptyState
            icon={<Icon name="zap" />}
            title="No runs yet"
            description="Runs appear when a rule’s trigger happens, or when you test one."
          />
        )
      }
    />
  );
}
