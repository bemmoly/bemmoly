import type { MatrixSpec, Scalar } from '../../../../shared/pipeline-spec.ts';

export type MatrixCell = Record<string, Scalar>;

function matches(cell: MatrixCell, pattern: Readonly<Record<string, Scalar>>): boolean {
  return Object.entries(pattern).every(([axis, value]) => cell[axis] === value);
}

/**
 * Every combination of the axes, in the order they are written, minus the cells an exclude
 * pattern matches, plus each include cell that is not already there.
 */
export function expandMatrix(matrix: MatrixSpec): MatrixCell[] {
  let cells: MatrixCell[] = [{}];
  for (const [axis, values] of Object.entries(matrix.axes)) {
    cells = cells.flatMap((cell) => values.map((value) => ({ ...cell, [axis]: value })));
  }
  cells = cells.filter((cell) => !matrix.exclude.some((pattern) => matches(cell, pattern)));
  for (const extra of matrix.include) {
    const present = cells.some(
      (cell) => Object.keys(cell).length === Object.keys(extra).length && matches(cell, extra),
    );
    if (!present) cells.push({ ...extra });
  }
  return cells;
}

/** "node-24-linux": a cell as a key suffix. */
export function cellKey(cell: MatrixCell): string {
  return Object.values(cell)
    .map((value) =>
      String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    )
    .filter(Boolean)
    .join('-');
}

/** "node 24, linux": a cell as a name suffix. */
export function cellName(cell: MatrixCell): string {
  return Object.entries(cell)
    .map(([axis, value]) => `${axis} ${String(value)}`)
    .join(', ');
}
