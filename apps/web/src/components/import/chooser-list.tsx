import { Checkbox, VirtualList } from '@bemmoly/ui';
import { useId } from 'react';
import { chooserKeyDown, PAGE_ROWS } from '../../hooks/container-chooser-keys.ts';
import type { ContainerChooser } from '../../hooks/use-container-chooser.ts';
import { ChooserRow, ChooserRowSkeleton, chooserColumns } from './chooser-row.tsx';

interface ChooserListProps {
  chooser: ContainerChooser;
  /** "Jira", for the list's name. */
  label: string;
  /** Projects show their lead; spaces and files do not. */
  withLead: boolean;
}

/** The header with the tri-state select-all, then the rows as one multi-select listbox. */
export function ChooserList({ chooser, label, withLead }: ChooserListProps) {
  const base = useId();
  const { nouns, rows, narrow, rowHeight, active, head } = chooser;
  const optionId = (index: number) => `${base}-opt-${index}`;
  const recordsTitle = nouns.records.charAt(0).toUpperCase() + nouns.records.slice(1);
  const columns = ['Key', 'Name', 'Type', ...(withLead ? ['Lead'] : []), recordsTitle, 'Status'];
  const height = Math.max(1, Math.min(PAGE_ROWS, chooser.count)) * rowHeight;
  return (
    <div className="flex flex-col">
      <div
        className={`grid h-8.5 border-b border-line px-4 text-12 font-medium text-tx-3 ${
          narrow
            ? 'grid-cols-[30px_minmax(0,1fr)] items-center gap-x-2'
            : chooserColumns(withLead, false)
        }`}
      >
        <span className="flex items-center">
          <Checkbox
            aria-label="Select all shown"
            checked={head === true}
            indeterminate={head === 'mixed'}
            onChange={chooser.toggleAll}
          />
        </span>
        {narrow ? (
          <span aria-hidden>Select all shown</span>
        ) : (
          columns.map((name) => (
            <span key={name} aria-hidden className={name === recordsTitle ? 'text-end' : undefined}>
              {name}
            </span>
          ))
        )}
      </div>
      <VirtualList
        id={chooser.listId}
        keepInView={active}
        count={chooser.count}
        rowHeight={rowHeight}
        height={height}
        onRangeChange={chooser.setRange}
        role="listbox"
        aria-multiselectable="true"
        aria-label={`${label} ${nouns.containers}`}
        aria-activedescendant={rows[active] ? optionId(active) : undefined}
        tabIndex={0}
        onKeyDown={(event) => chooserKeyDown(event, chooser)}
        className="focus-ring-inset"
        renderRow={(index, style) => {
          const row = rows[index];
          if (!row) {
            return (
              <ChooserRowSkeleton key={index} style={style} withLead={withLead} narrow={narrow} />
            );
          }
          return (
            <ChooserRow
              key={row.id}
              id={optionId(index)}
              row={row}
              style={style}
              active={index === active}
              withLead={withLead}
              narrow={narrow}
              nouns={nouns}
              onPick={(event) => {
                chooser.toggle(index, event.shiftKey);
                chooser.focusList();
              }}
            />
          );
        }}
      />
    </div>
  );
}
