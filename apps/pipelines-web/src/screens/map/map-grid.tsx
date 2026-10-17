import { formatNumber, useT } from '@bemmoly/core-web';
import type { MapColumn, MapRow } from '@bemmoly/module-pipelines/shared';
import { EntityTile, Skeleton, type EntityHue } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { KeyboardEvent, ReactNode } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { MapCellView } from './map-cell.tsx';
import { useReleaseMap, type MapState } from './use-map.ts';

const HEAD =
  'flex items-center gap-1 border-b border-line bg-sunken px-3 py-2.5 text-12 font-semibold text-tx-2';
const ROW_HEAD = 'sticky start-0 z-1 flex min-w-0 items-center gap-2 bg-card px-3 py-2';

export interface MapGridActions {
  /** A domain or group row zooms the scope; an application row opens the application. */
  onZoom: (row: MapRow) => void;
  onToggle: (row: MapRow) => void;
  onOpenCell: (row: MapRow, column: MapColumn) => void;
}

function columnsTemplate(count: number) {
  return { gridTemplateColumns: `minmax(168px, 200px) repeat(${count}, minmax(132px, 1fr))` };
}

/** Up and Down walk the row heads; Right opens a domain in place, Left closes it. */
function onGridKey(event: KeyboardEvent<HTMLDivElement>) {
  const heads = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-row-head]')];
  const index = heads.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (step) {
    event.preventDefault();
    heads[Math.max(0, Math.min(heads.length - 1, index + step))]?.focus();
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    const toggle = heads[index]?.parentElement?.querySelector<HTMLButtonElement>('[data-toggle]');
    const open = toggle?.getAttribute('aria-expanded') === 'true';
    if (toggle && open === (event.key === 'ArrowLeft')) {
      event.preventDefault();
      toggle.click();
    }
  }
}

function Row({
  row,
  columns,
  state,
  actions,
  nested,
}: {
  row: MapRow;
  columns: readonly MapColumn[];
  state: MapState;
  actions: MapGridActions;
  nested: boolean;
}) {
  const t = useT(pipelinesText);
  const expandable = row.kind === 'domain' && !state.scope;
  const open = expandable && state.open.includes(row.key);
  return (
    <>
      <div role="row" className="contents">
        <div role="rowheader" className={`${ROW_HEAD} ${nested ? 'ps-10' : ''}`}>
          {expandable ? (
            <button
              type="button"
              data-toggle
              aria-expanded={open}
              aria-label={t(open ? 'pipelines.map.collapse' : 'pipelines.map.expand', {
                name: row.name,
              })}
              onClick={() => actions.onToggle(row)}
              className="-ms-1 grid size-5 shrink-0 place-items-center rounded-chip text-tx-3 hover:bg-hover hover:text-tx focus-ring"
            >
              <Icon
                name={open ? 'caret' : 'chevron'}
                size={12}
                className={open ? '' : 'rtl:-scale-x-100'}
              />
            </button>
          ) : null}
          {row.color ? <EntityTile name={row.name} hue={row.color as EntityHue} size={18} /> : null}
          <button
            type="button"
            data-row-head
            onClick={() => actions.onZoom(row)}
            className={`min-w-0 flex-1 truncate rounded-chip text-start text-13 hover:text-acc focus-ring ${
              nested ? 'text-tx-2' : 'font-medium text-tx'
            }`}
          >
            {row.name}
          </button>
          <span className="shrink-0 text-12 text-tx-3 tabular-nums">{formatNumber(row.count)}</span>
        </div>
        {columns.map((column) => {
          const cell = row.cells.find((item) => item.column === column.key);
          const body = <MapCellView cell={cell} column={column} still={Boolean(state.at)} />;
          return (
            <div
              key={column.key}
              role="cell"
              className="min-w-0 border-s border-line-2 px-2.5 py-2"
            >
              {row.kind === 'application' ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => actions.onOpenCell(row, column)}
                  className="block w-full rounded-chip text-start hover:bg-hover"
                >
                  {body}
                </button>
              ) : (
                body
              )}
            </div>
          );
        })}
      </div>
      {open ? <Opened domain={row.key} columns={columns} state={state} actions={actions} /> : null}
      <div aria-hidden className="col-span-full border-b border-line-2" />
    </>
  );
}

/** A domain opened in place: its groups, read from the domain's own map. */
function Opened({
  domain,
  columns,
  state,
  actions,
}: {
  domain: string;
  columns: readonly MapColumn[];
  state: MapState;
  actions: MapGridActions;
}) {
  const map = useReleaseMap(state, domain);
  if (!map.data)
    return (
      <div className="col-span-full flex items-center gap-3 px-10 py-2.5">
        <Skeleton width={120} height={10} />
      </div>
    );
  return map.data.rows.map((row) => (
    <Row key={row.id} row={row} columns={columns} state={state} actions={actions} nested />
  ));
}

export function MapGrid({
  rows,
  columns,
  state,
  actions,
  label,
}: {
  rows: readonly MapRow[];
  columns: readonly MapColumn[];
  state: MapState;
  actions: MapGridActions;
  label: string;
}) {
  const t = useT(pipelinesText);
  const first = rows[0]?.kind ?? 'domain';
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-card shadow-e1">
      <div
        role="table"
        aria-label={label}
        onKeyDown={onGridKey}
        className="grid min-w-max md:min-w-0"
        style={columnsTemplate(columns.length)}
      >
        <div role="row" className="contents">
          <div role="columnheader" className={`${HEAD} sticky start-0 z-1`}>
            {t(`pipelines.map.kind.${first}`)}
          </div>
          {columns.map((column) => (
            <div key={column.key} role="columnheader" className={`${HEAD} border-s border-line-2`}>
              <span className="truncate">{column.label}</span>
              {column.kind === 'environment' && column.protected ? (
                <Icon name="shield" size={12} aria-label={t('pipelines.common.protected')} />
              ) : null}
            </div>
          ))}
        </div>
        {rows.map((row) => (
          <Row
            key={row.id}
            row={row}
            columns={columns}
            state={state}
            actions={actions}
            nested={false}
          />
        ))}
      </div>
    </div>
  );
}

export function MapGridSkeleton(): ReactNode {
  return (
    <div aria-busy className="rounded-card border border-line bg-card shadow-e1">
      <div className="h-9 border-b border-line bg-sunken" />
      {Array.from({ length: 9 }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-[200px_repeat(6,1fr)] gap-3 border-b border-line-2 px-3 py-3"
        >
          <Skeleton width={110} height={12} />
          {Array.from({ length: 6 }, (_, cell) => (
            <div key={cell} className="flex flex-col gap-1.5">
              <Skeleton width="100%" height={8} />
              <Skeleton width={40} height={8} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
