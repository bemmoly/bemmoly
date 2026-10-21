import type { ReportResult, ReportUnit } from '@bemmoly/module-work/shared';
import { BarChart, StatTile, Table } from '@bemmoly/ui';
import { ReportNote } from './report-card.tsx';
import { UNIT_LABELS } from './report-export.ts';

/*
 * One built report as the spec asked to show it: a single number, bars per group with the
 * same numbers listed under them, or a table. The figures are always printed, so the chart
 * never carries a number alone.
 */

export function formatValue(value: number, unit: ReportUnit): string {
  switch (unit) {
    case 'percent':
      return `${Math.round(value)}%`;
    case 'days':
      return `${value.toFixed(1)} d`;
    case 'points':
      return `${Number.isInteger(value) ? value : value.toFixed(1)} pts`;
    case 'issues':
      return String(value);
  }
}

const issuesLine = (count: number) => (count === 1 ? '1 issue' : `${count} issues`);

type Row = ReportResult['rows'][number];

function RowList({ result }: { result: ReportResult }) {
  return (
    <ul aria-label={result.spec.title} className="m-0 flex list-none flex-col p-0">
      {result.rows.map((row) => (
        <li
          key={row.id ?? 'none'}
          className="flex items-baseline gap-3 border-b border-line py-1 text-13 last:border-b-0"
        >
          <span className="mr-auto min-w-0 truncate text-tx">{row.label}</span>
          <span className="font-mono text-12 tabular-nums text-tx">
            {formatValue(row.value, result.unit)}
          </span>
          <span className="w-20 text-right text-12 text-tx-3">{issuesLine(row.issues)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReportFigure({ result }: { result: ReportResult }) {
  const { spec, unit } = result;
  if (result.issues === 0) return <ReportNote>No issues match this report yet.</ReportNote>;
  if (spec.chart === 'number' || result.rows.length === 0) {
    return (
      <StatTile
        label={spec.title}
        value={formatValue(result.total, unit)}
        detail={`from ${issuesLine(result.issues)}`}
        className="max-w-80 shadow-none"
      />
    );
  }
  if (spec.chart === 'table') {
    return (
      <Table<Row>
        label={spec.title}
        density="sm"
        rows={result.rows}
        rowKey={(row) => row.id ?? 'none'}
        columns={[
          { key: 'label', header: 'Group', width: 'minmax(0,1fr)', render: (row) => row.label },
          {
            key: 'value',
            header: UNIT_LABELS[unit],
            width: '120px',
            align: 'end',
            render: (row) => (
              <span className="font-mono text-12 tabular-nums">{formatValue(row.value, unit)}</span>
            ),
          },
          {
            key: 'issues',
            header: 'Issues counted',
            width: '120px',
            align: 'end',
            hideOnPhone: true,
            render: (row) => <span className="tabular-nums">{row.issues}</span>,
          },
        ]}
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <BarChart
        label={spec.title}
        xLabels={result.rows.map((row) => row.label)}
        series={[
          {
            id: 'value',
            label: UNIT_LABELS[unit],
            tone: 'prog',
            values: result.rows.map((row) => row.value),
          },
        ]}
      />
      <RowList result={result} />
    </div>
  );
}
