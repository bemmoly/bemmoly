import { StatusGlyph, type StatusStage } from '@bemmoly/ui';
import type { ColumnModel } from '../hooks/board-model.ts';

export interface PhoneColumnsProps {
  columns: readonly ColumnModel[];
  stages: Readonly<Record<string, StatusStage>>;
  value: string | null;
  onChange: (columnId: string) => void;
}

/** The status segments a phone switches columns with; the row scrolls sideways. */
export function PhoneColumns({ columns, stages, value, onChange }: PhoneColumnsProps) {
  return (
    <div
      role="tablist"
      aria-label="Column"
      className="sticky top-0 z-2 -mx-4 flex gap-1.5 overflow-x-auto bg-sunken px-4 py-2.5 [scrollbar-width:none]"
    >
      {columns.map((column) => {
        const on = column.id === value;
        return (
          <button
            key={column.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(column.id)}
            className={`focus-ring inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-control border-0 px-2.5 font-sans text-13 ${on ? 'bg-acc-50 font-semibold text-acc' : 'bg-transparent text-tx-2'}`}
          >
            <StatusGlyph stage={stages[column.id] ?? 'todo'} size={12} decorative />
            {column.name}
            <span className="text-tx-3 tabular-nums">{column.count}</span>
          </button>
        );
      })}
    </div>
  );
}
