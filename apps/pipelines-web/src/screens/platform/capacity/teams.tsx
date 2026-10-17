import { useT } from '@bemmoly/core-web';
import type { TeamShare } from '@bemmoly/module-pipelines/shared';
import { Button, EntityTile, ProgressBar, Table, type TableColumn } from '@bemmoly/ui';
import { useState } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { formatDuration } from '../../../lib/format.ts';

const SHOWN = 8;

/** Busiest first: teams borrowing beyond their share, then by how much they run. */
export function rankTeams(teams: readonly TeamShare[]): TeamShare[] {
  return [...teams].sort(
    (a, b) =>
      Number(b.borrowing) - Number(a.borrowing) ||
      b.running - a.running ||
      a.team.name.localeCompare(b.team.name),
  );
}

/**
 * Each team's fair share: what it runs against what it is guaranteed, marked when it borrows
 * idle capacity beyond it, and how long its jobs wait.
 */
export function Teams({ teams }: { teams: readonly TeamShare[] }) {
  const t = useT(pipelinesText);
  const [all, setAll] = useState(false);
  const ranked = rankTeams(teams);
  const rows = all ? ranked : ranked.slice(0, SHOWN);
  const columns: TableColumn<TeamShare>[] = [
    {
      key: 'team',
      header: t('pipelines.capacity.team'),
      width: 'minmax(0,1fr)',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <EntityTile name={row.team.name} size={18} />
          <span className="truncate font-medium text-tx">{row.team.name}</span>
        </span>
      ),
    },
    {
      key: 'share',
      header: t('pipelines.capacity.fairShare'),
      width: 'minmax(120px,1fr)',
      render: (row) => (
        <span className="flex w-full flex-col gap-1">
          <span className={row.borrowing ? 'text-12 text-amber-tx' : 'text-12 text-tx'}>
            {row.borrowing
              ? t('pipelines.capacity.borrowing', { running: row.running, share: row.share })
              : t('pipelines.capacity.runningOf', { running: row.running, share: row.share })}
          </span>
          <ProgressBar
            value={row.share > 0 ? Math.min(100, (row.running / row.share) * 100) : 0}
            label={t('pipelines.capacity.shareLabel', { team: row.team.name })}
            fillClassName={row.borrowing ? 'bg-amber' : 'bg-acc-500'}
          />
        </span>
      ),
    },
    {
      key: 'wait',
      header: t('pipelines.capacity.waitP95'),
      width: '72px',
      align: 'end',
      render: (row) => (
        <span className="text-12 text-tx-3 tabular-nums">
          {row.waitP95Seconds === null
            ? t('pipelines.insights.none')
            : formatDuration(row.waitP95Seconds)}
        </span>
      ),
    },
  ];
  return (
    <>
      <Table
        label={t('pipelines.capacity.teamsLabel')}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.team.id}
      />
      {ranked.length > SHOWN && (
        <Button size="xs" variant="ghost" className="m-2 self-start" onClick={() => setAll(!all)}>
          {all
            ? t('pipelines.capacity.fewerTeams')
            : t('pipelines.capacity.allTeams', { count: ranked.length })}
        </Button>
      )}
    </>
  );
}
