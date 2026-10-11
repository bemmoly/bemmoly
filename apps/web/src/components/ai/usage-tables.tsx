import type { AiUsageBucket, AiUsageResponse } from '@bemmoly/shared';
import { Card, CardHeader, SegmentedControl, Table, type TableColumn } from '@bemmoly/ui';
import { useState } from 'react';
import { ROLE_COPY } from '../../hooks/use-ai-roles.ts';
import { formatCount, formatUsd } from '../../lib/ai-format.ts';

type Group = 'byRole' | 'byPurpose' | 'byModel';

const GROUPS: { value: Group; label: string; column: string }[] = [
  { value: 'byRole', label: 'Role', column: 'Role' },
  { value: 'byPurpose', label: 'Purpose', column: 'Purpose' },
  { value: 'byModel', label: 'Model', column: 'Model' },
];

/** Purposes as people say them; an unknown one is shown with its dots and underscores spaced. */
const PURPOSES: Record<string, string> = {
  summary: 'Summaries',
  brief: 'Morning briefs',
  qa: 'Questions and answers',
  plan: 'Palette plans',
  autocomplete: 'Writing suggestions',
  consistency: 'Consistency checks',
  fill_field: 'Field suggestions',
  embed: 'Search indexing',
  tldr: 'Page TL;DRs',
  pulse: 'Sprint pulse',
  forecast: 'Forecasts',
  draft: 'Drafting',
  connection_test: 'Connection tests',
};

export function bucketName(group: Group, key: string): string {
  if (group === 'byRole') return ROLE_COPY[key as keyof typeof ROLE_COPY]?.label ?? key;
  if (group === 'byPurpose') {
    const known = PURPOSES[key];
    if (known) return known;
    const words = key.replace(/[._]/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return key;
}

/**
 * This month's spend from every AI call, by role, purpose or model: runs, tokens in and out,
 * and cost, the biggest first. Empty until the first call.
 */
export function UsageTables({ usage }: { usage: AiUsageResponse }) {
  const [group, setGroup] = useState<Group>('byRole');
  const rows = usage[group];
  const column = GROUPS.find((entry) => entry.value === group)?.column ?? '';
  const columns: TableColumn<AiUsageBucket>[] = [
    {
      key: 'key',
      header: column,
      width: 'minmax(0,2fr)',
      render: (row) => (
        <span
          title={bucketName(group, row.key)}
          className={`truncate ${group === 'byModel' ? 'font-mono text-12' : 'font-medium'}`}
        >
          {bucketName(group, row.key)}
        </span>
      ),
    },
    {
      key: 'runs',
      header: 'Calls',
      width: '80px',
      align: 'end',
      render: (row) => <span className="tabular-nums">{formatCount(row.runs)}</span>,
    },
    {
      key: 'tokens',
      header: 'Tokens in · out',
      width: '140px',
      align: 'end',
      hideOnPhone: true,
      render: (row) => (
        <span className="text-tx-2 tabular-nums">
          {formatCount(row.inputTokens)} · {formatCount(row.outputTokens)}
        </span>
      ),
    },
    {
      key: 'cost',
      header: 'Cost',
      width: '90px',
      align: 'end',
      render: (row) => <span className="font-medium tabular-nums">{formatUsd(row.costUsd)}</span>,
    },
  ];
  return (
    <Card>
      <CardHeader
        title="Usage this month"
        hint={`${formatCount(usage.totals.runs)} calls · ${formatUsd(usage.totals.costUsd)}${
          usage.failures > 0 ? ` · ${usage.failures} failed` : ''
        }`}
        actions={
          <SegmentedControl<Group>
            size="sm"
            options={GROUPS.map(({ value, label }) => ({ value, label }))}
            value={group}
            onChange={setGroup}
          />
        }
      />
      <Table
        label={`Usage by ${column.toLowerCase()}`}
        className="rounded-none! border-0!"
        density="sm"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.key}
        empty={
          <span className="block px-4 py-5 text-13 text-tx-3">
            No AI calls yet this month. Usage appears here as people use summaries, briefs and the
            palette.
          </span>
        }
      />
    </Card>
  );
}
