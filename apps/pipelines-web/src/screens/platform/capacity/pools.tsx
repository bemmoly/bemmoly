import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunnerPool } from '@bemmoly/module-pipelines/shared';
import {
  IconButton,
  Menu,
  MenuItem,
  ProgressBar,
  Spinner,
  Table,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';

const share = (busy: number, max: number) => (max > 0 ? busy / max : 0);

/**
 * "Google Cloud Build · europe-west1 · nila-ci" for a Cloud Build pool, "GKE Autopilot ·
 * europe-west1 · bemmoly-runners" for an Autopilot one; else where it says.
 */
function whereOf(pool: RunnerPool, words: { cloudBuild: string; autopilot: string }): string {
  if (pool.cloudBuild) {
    return [words.cloudBuild, pool.cloudBuild.region, pool.cloudBuild.account.externalId].join(
      ' · ',
    );
  }
  if (pool.autopilot) {
    return [words.autopilot, pool.autopilot.location, pool.autopilot.cluster.name].join(' · ');
  }
  return pool.location ?? pool.hosting;
}

/** While an Autopilot pool is prepared, or why it could not be, in GKE's words. */
function Preparing({ pool }: { pool: RunnerPool }) {
  const t = useT(pipelinesText);
  const autopilot = pool.autopilot;
  if (!autopilot || autopilot.status === 'ready') return null;
  if (autopilot.status === 'failed') {
    return (
      <span className="flex items-start gap-1 text-12 text-amber-tx">
        <Icon name="warning" size={12} className="mt-0.5 shrink-0" />
        <span className="line-clamp-2">{autopilot.statusDetail}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-12 text-tx-3">
      <Spinner size={12} />
      <span className="line-clamp-2">
        {autopilot.statusDetail ?? t('pipelines.capacity.podPreparing')}
      </span>
    </span>
  );
}

/**
 * Runner pools: where they run, how busy they are against their ceiling, how they scale, and
 * for a pool whose machines Pipelines starts why its last one would not start. An Autopilot
 * pool also shows its pods now and its warm room. Its menu changes where it runs.
 */
export function Pools({
  pools,
  onRotate,
  onEdit,
}: {
  pools: readonly RunnerPool[];
  onRotate: (pool: RunnerPool) => void;
  onEdit: (pool: RunnerPool) => void;
}) {
  const t = useT(pipelinesText);
  const columns: TableColumn<RunnerPool>[] = [
    {
      key: 'name',
      header: t('pipelines.capacity.pool'),
      width: 'minmax(0,1.3fr)',
      render: (pool) => (
        <span className="flex min-w-0 flex-col leading-card">
          <span className="truncate font-medium text-tx">{pool.name}</span>
          <span className="truncate text-12 text-tx-3">
            {whereOf(pool, {
              cloudBuild: t('pipelines.capacity.kindCloudBuild'),
              autopilot: t('pipelines.capacity.kindAutopilot'),
            })}
          </span>
          <Preparing pool={pool} />
          {pool.lastError && (
            <span className="flex items-start gap-1 text-12 text-amber-tx">
              <Icon name="warning" size={12} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2">{pool.lastError}</span>
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'busy',
      header: t('pipelines.capacity.busy'),
      width: 'minmax(120px,1fr)',
      render: (pool) => {
        const used = share(pool.busy, pool.max);
        return (
          <span className="flex w-full flex-col gap-1">
            <span className="flex items-center text-12 text-tx">
              {pool.hosting === 'cloud-build'
                ? t('pipelines.capacity.buildsOf', { busy: pool.busy, max: pool.max })
                : pool.hosting === 'gke-autopilot'
                  ? t('pipelines.capacity.podsOf', { busy: pool.busy, max: pool.max })
                  : t('pipelines.capacity.busyOf', { busy: pool.busy, max: pool.max })}
              <span className="ms-auto text-tx-3">
                {formatNumber(used, { style: 'percent', maximumFractionDigits: 0 })}
              </span>
            </span>
            <ProgressBar
              value={used * 100}
              label={t('pipelines.capacity.busyLabel', { pool: pool.name })}
              fillClassName={used > 0.85 || pool.atLimit ? 'bg-amber' : 'bg-acc-500'}
            />
          </span>
        );
      },
    },
    {
      key: 'scaling',
      header: t('pipelines.capacity.scaling'),
      width: 'minmax(0,0.9fr)',
      hideOnPhone: true,
      render: (pool) => (
        <span className="flex flex-col text-12 leading-card">
          <span className={pool.atLimit ? 'text-amber-tx' : 'text-tx-2'}>{pool.scaling}</span>
          {pool.autopilot && (
            <span className="text-tx-3">
              {t('pipelines.capacity.podsNow', {
                running: pool.autopilot.runners.running,
                starting: pool.autopilot.runners.starting,
                warm: pool.autopilot.runners.warm,
              })}
            </span>
          )}
          {pool.queued > 0 && (
            <span className="text-tx-3">
              {t('pipelines.capacity.poolQueued', { count: pool.queued })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'menu',
      header: '',
      width: '32px',
      align: 'end',
      render: (pool) => (
        <Menu
          align="end"
          trigger={(props) => (
            <IconButton {...props} size="sm" label={t('pipelines.capacity.poolMenu')} icon="more" />
          )}
        >
          <MenuItem icon={<Icon name="sliders" size={14} />} onSelect={() => onEdit(pool)}>
            {t('pipelines.capacity.changePool')}
          </MenuItem>
          <MenuItem icon={<Icon name="key" size={14} />} onSelect={() => onRotate(pool)}>
            {t('pipelines.capacity.rotateToken')}
          </MenuItem>
        </Menu>
      ),
    },
  ];
  return (
    <Table
      label={t('pipelines.capacity.poolsLabel')}
      columns={columns}
      rows={[...pools].sort((a, b) => b.busy - a.busy || a.name.localeCompare(b.name))}
      rowKey={(pool) => pool.id}
    />
  );
}
