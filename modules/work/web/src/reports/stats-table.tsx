import type { ReportStats } from '@bemmoly/module-work/shared';

/*
 * Two fields crossed: a row per value of the first, a column per value of the
 * second, totals on the right and at the foot. The tint deepens with the count
 * on the accent steps the pairing matrix uses, and the count is always printed
 * so colour never carries the number alone.
 */

const TINT = ['text-tx-3', 'bg-acc-50 text-tx', 'bg-acc-100 text-tx', 'bg-acc-500 text-on-acc'];

const CELL = 'px-2 py-1 text-right font-mono text-12 tabular-nums';
const HEAD = 'px-2 py-1 text-left text-12 font-medium text-tx-2';

const keyOf = (row: string | null, column: string | null) => `${row ?? ''}\u0001${column ?? ''}`;

export function tintStep(count: number, most: number): number {
  if (count <= 0 || most <= 0) return 0;
  return Math.min(3, Math.max(1, Math.ceil((count / most) * 3)));
}

export function StatsTable({ stats, caption }: { stats: ReportStats; caption: string }) {
  const columns = stats.columns ?? [];
  const cells = new Map((stats.cells ?? []).map((cell) => [keyOf(cell.row, cell.column), cell]));
  const most = Math.max(0, ...(stats.cells ?? []).map((cell) => cell.count));
  const columnTotal = (id: string | null) =>
    (stats.cells ?? []).filter((cell) => cell.column === id).reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="border-separate border-spacing-0.5">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <td />
            {columns.map((column) => (
              <th key={column.id ?? 'none'} scope="col" className={HEAD}>
                {column.label}
              </th>
            ))}
            <th scope="col" className={HEAD}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {stats.rows.map((row) => (
            <tr key={row.id ?? 'none'}>
              <th scope="row" className={`${HEAD} max-w-60 truncate`} title={row.label}>
                {row.label}
              </th>
              {columns.map((column) => {
                const count = cells.get(keyOf(row.id, column.id))?.count ?? 0;
                return (
                  <td
                    key={column.id ?? 'none'}
                    className={`${CELL} ${TINT[tintStep(count, most)]}`}
                  >
                    {count}
                  </td>
                );
              })}
              <td className={`${CELL} font-semibold text-tx`}>{row.count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={HEAD}>
              Total
            </th>
            {columns.map((column) => (
              <td key={column.id ?? 'none'} className={`${CELL} font-semibold text-tx`}>
                {columnTotal(column.id)}
              </td>
            ))}
            <td className={`${CELL} font-semibold text-tx`}>{stats.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
