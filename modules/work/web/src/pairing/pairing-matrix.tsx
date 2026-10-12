import type { PairingMatrix } from '@bemmoly/module-work/shared';
import { Avatar, focusRingInset } from '@bemmoly/ui';
import { cx } from '../issue/cx.ts';
import { useRef, useState, type KeyboardEvent } from 'react';
import { gridOf, pairKey, tintLevel, type TintLevel } from './model.ts';

/*
 * The square table: one row and one column per person, a cell per pair with the count printed
 * on a tint that deepens with it. One roving tab stop; the arrows move it, Enter opens the pair.
 */

const TINT: Record<TintLevel, string> = {
  0: 'bg-sunken text-tx-3',
  1: 'bg-acc-50 text-tx',
  2: 'bg-acc-100 text-tx',
  3: 'bg-acc-500 text-on-acc',
  4: 'bg-acc-fill text-on-acc',
};

const CELL = 'size-10 min-w-10 text-center font-mono text-12 tabular-nums';

export interface PairingMatrixProps {
  matrix: PairingMatrix;
  /** The open pair, "a,b" with the ids in order. */
  open: string | null;
  onOpen: (a: string, b: string) => void;
}

export function PairingMatrixTable({ matrix, open, onOpen }: PairingMatrixProps) {
  const { people } = matrix;
  const grid = gridOf(matrix);
  const [focus, setFocus] = useState<[number, number]>([0, 1]);
  const table = useRef<HTMLTableElement>(null);
  const size = people.length;

  const move = (row: number, col: number) => {
    const next: [number, number] = [
      Math.min(size - 1, Math.max(0, row)),
      Math.min(size - 1, Math.max(0, col)),
    ];
    setFocus(next);
    table.current?.querySelector<HTMLElement>(`[data-cell="${next[0]}:${next[1]}"]`)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent, row: number, col: number) => {
    const steps: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    move(row + step[0], col + step[1]);
  };

  return (
    <div className="min-h-0 overflow-auto">
      <table ref={table} className="border-separate border-spacing-0.5" aria-label="Pairing">
        <thead>
          <tr>
            <td className="sticky top-0 left-0 z-20 bg-canvas" />
            {people.map((person) => (
              <th
                key={person.id}
                scope="col"
                className="sticky top-0 z-10 bg-canvas pb-1 align-bottom font-normal"
              >
                <span className="inline-flex" title={person.name}>
                  <Avatar name={person.name} size={24} />
                </span>
                <span className="sr-only">{person.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((rowPerson, row) => (
            <tr key={rowPerson.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-canvas pr-3 text-left text-13 font-normal whitespace-nowrap text-tx"
              >
                <span className="inline-flex items-center gap-2">
                  <Avatar name={rowPerson.name} size={20} />
                  {rowPerson.name}
                  <span className="text-12 text-tx-3 tabular-nums">{rowPerson.issues}</span>
                </span>
              </th>
              {people.map((colPerson, col) => {
                if (row === col) return <td key={colPerson.id} aria-hidden className={CELL} />;
                const cell = grid.cell(rowPerson.id, colPerson.id);
                const count = cell?.count ?? 0;
                const selected = open === pairKey(rowPerson.id, colPerson.id);
                const focused = focus[0] === row && focus[1] === col;
                return (
                  <td key={colPerson.id} className="p-0">
                    <button
                      type="button"
                      data-cell={`${row}:${col}`}
                      tabIndex={focused ? 0 : -1}
                      aria-pressed={selected}
                      aria-label={`${rowPerson.name} and ${colPerson.name}: ${
                        count === 0
                          ? 'never paired'
                          : `${count} shared ${count === 1 ? 'issue' : 'issues'}`
                      }`}
                      onClick={() => {
                        setFocus([row, col]);
                        onOpen(rowPerson.id, colPerson.id);
                      }}
                      onKeyDown={(event) => onKeyDown(event, row, col)}
                      className={cx(
                        CELL,
                        'cursor-pointer rounded-chip border-0',
                        TINT[tintLevel(count, grid.most)],
                        selected && 'shadow-ring-ac',
                        focusRingInset,
                      )}
                    >
                      {count === 0 ? '' : count}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
