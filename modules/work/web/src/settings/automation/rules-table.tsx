import type { AutomationRule } from '@bemmoly/module-work/shared';
import {
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  RelativeTime,
  Switch,
  Table,
  TableSkeleton,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { actionsSentence, triggerSentence } from './describe.ts';
import { RunState } from './run-state.tsx';

const WIDTHS = ['minmax(0,2fr)', 'minmax(0,1fr)', '56px', '40px'];

interface RulesTableProps {
  label: string;
  rules: readonly AutomationRule[];
  canChange: (rule: AutomationRule) => boolean;
  onOpen: (rule: AutomationRule) => void;
  onEnabled: (rule: AutomationRule, enabled: boolean) => void;
  onTest: (rule: AutomationRule) => void;
  onDelete: (rule: AutomationRule) => void;
  empty: ReactNode;
}

/** Rules in the one table: what each does, how it last ran, on or off, and its menu. */
export function RulesTable(props: RulesTableProps) {
  const { canChange } = props;
  const columns: TableColumn<AutomationRule>[] = [
    {
      key: 'rule',
      header: 'Rule',
      width: WIDTHS[0]!,
      render: (rule) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{rule.name}</span>
          <span className="truncate text-12 text-tx-3">
            {triggerSentence(rule)}, {actionsSentence(rule)}
          </span>
        </span>
      ),
    },
    {
      key: 'last',
      header: 'Last run',
      width: WIDTHS[1]!,
      hideOnPhone: true,
      render: (rule) =>
        rule.lastRunStatus && rule.lastRunAt ? (
          <span className="flex min-w-0 flex-col items-start">
            <RunState status={rule.lastRunStatus} />
            <RelativeTime iso={rule.lastRunAt} className="text-12 text-tx-3" />
          </span>
        ) : (
          <span className="text-tx-3">Not run yet</span>
        ),
    },
    {
      key: 'enabled',
      header: 'On',
      width: WIDTHS[2]!,
      render: (rule) => (
        <span onClick={(event) => event.stopPropagation()} className="inline-flex">
          <Switch
            aria-label={`Turn ${rule.name} ${rule.enabled ? 'off' : 'on'}`}
            checked={rule.enabled}
            disabled={!canChange(rule)}
            onCheckedChange={(on) => props.onEnabled(rule, on)}
          />
        </span>
      ),
    },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: WIDTHS[3]!,
      align: 'end',
      render: (rule) => (
        <span onClick={(event) => event.stopPropagation()} className="inline-flex">
          <Menu
            align="end"
            trigger={(trigger) => (
              <IconButton
                {...trigger}
                icon="more"
                size="sm"
                label={`Actions for ${rule.name}`}
                tip="Actions"
              />
            )}
          >
            <MenuItem icon={<Icon name="edit" />} onSelect={() => props.onOpen(rule)}>
              {canChange(rule) ? 'Edit…' : 'View…'}
            </MenuItem>
            <MenuItem
              icon={<Icon name="zap" />}
              disabled={!canChange(rule)}
              onSelect={() => props.onTest(rule)}
            >
              Test run…
            </MenuItem>
            <MenuSeparator />
            <MenuItem
              icon={<Icon name="trash" />}
              tone="danger"
              disabled={!canChange(rule)}
              onSelect={() => props.onDelete(rule)}
            >
              Delete rule
            </MenuItem>
          </Menu>
        </span>
      ),
    },
  ];
  return (
    <Table
      label={props.label}
      columns={columns}
      rows={props.rules}
      rowKey={(rule) => rule.id}
      onRowClick={props.onOpen}
      empty={props.empty}
    />
  );
}

export function RulesSkeleton() {
  return (
    <TableSkeleton label="Loading rules" rows={3} columns={WIDTHS.map((width) => ({ width }))} />
  );
}
