import type { PairingCell, PairingMatrix } from '@bemmoly/module-work/shared';

/*
 * The matrix as the table draws it: a cell for every two people, found by either order, and a
 * tint step from the count against the busiest pair, so a small team still uses the full scale.
 */

export const RANGES = ['30', '90', '365'] as const;
export type PairingRange = (typeof RANGES)[number];

export const RANGE_LABELS: Record<PairingRange, string> = {
  '30': '30 days',
  '90': '90 days',
  '365': 'Year',
};

export const isRange = (value: string | null): value is PairingRange =>
  (RANGES as readonly (string | null)[]).includes(value);

const DAY = 86_400_000;

/** The query for a range ending today, in the viewer's calendar. */
export function rangeQuery(range: PairingRange, now = new Date()) {
  const day = (time: number) => {
    const date = new Date(time);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  return { from: day(now.getTime() - (Number(range) - 1) * DAY), to: day(now.getTime()) };
}

export const pairKey = (a: string, b: string) => (a < b ? `${a},${b}` : `${b},${a}`);

export type TintLevel = 0 | 1 | 2 | 3 | 4;

/** 0 is never; 1 to 4 split the busiest pair's count in quarters. */
export function tintLevel(count: number, most: number): TintLevel {
  if (count <= 0 || most <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / most) * 4))) as TintLevel;
}

export interface Grid {
  cell: (a: string, b: string) => PairingCell | undefined;
  most: number;
}

export function gridOf(matrix: PairingMatrix): Grid {
  const cells = new Map(matrix.cells.map((cell) => [pairKey(cell.a, cell.b), cell]));
  const most = matrix.cells.reduce((max, cell) => Math.max(max, cell.count), 0);
  return { cell: (a, b) => cells.get(pairKey(a, b)), most };
}
