import { formatNumber, useT } from '@bemmoly/core-web';
import type { MapCell, MapColumn } from '@bemmoly/module-pipelines/shared';
import { DeployCell, type DeployCellFlag, type LaneDot } from '@bemmoly/ui';
import { pipelinesText } from '../../i18n/catalog.ts';

const MOVING = new Set(['running', 'waiting', 'failed']);

/** One cell in words and marks: the count, what is moving, and at most two flags. */
export function MapCellView({
  cell,
  column,
  still,
}: {
  cell: MapCell | undefined;
  column: MapColumn;
  still: boolean;
}) {
  const t = useT(pipelinesText);
  if (!cell) return <span className="text-12 text-tx-3">{t('pipelines.common.none')}</span>;
  const build = column.kind === 'build';
  const count = build
    ? t('pipelines.map.running', { count: cell.running, shown: formatNumber(cell.running) })
    : formatNumber(cell.total);
  const secondary =
    !build && cell.canary
      ? t('pipelines.map.canary', { count: cell.canary })
      : !build && cell.moving
        ? t('pipelines.map.moving', { count: cell.moving })
        : null;
  const flags: DeployCellFlag[] = [];
  if (cell.failed)
    flags.push({ tone: 'danger', text: t('pipelines.map.failed', { count: cell.failed }) });
  if (cell.waiting)
    flags.push({ tone: 'warn', text: t('pipelines.map.waiting', { count: cell.waiting }) });
  if (cell.rolledBack)
    flags.push({ tone: 'warn', text: t('pipelines.map.rolledBack', { count: cell.rolledBack }) });
  if (cell.note) flags.push({ tone: 'accent', text: cell.note });
  const dots: LaneDot[] = cell.dots
    .filter((dot) => MOVING.has(dot.state))
    .map((dot) => ({ id: dot.id, state: dot.state as LaneDot['state'], position: dot.progress }));
  const label = [
    column.label,
    build
      ? t('pipelines.map.running', { count: cell.running, shown: formatNumber(cell.running) })
      : t('pipelines.map.applications', { count: cell.total, shown: formatNumber(cell.total) }),
    secondary,
    ...flags.map((flag) => flag.text),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <DeployCell
      count={count}
      secondary={secondary}
      dots={dots}
      flags={flags.slice(0, 2)}
      label={label}
      still={still}
    />
  );
}
