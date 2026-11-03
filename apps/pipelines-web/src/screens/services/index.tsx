import { formatNumber, useShortcutHelp, useT } from '@bemmoly/core-web';
import { Button, EmptyState, SearchInput, SegmentedControl, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useRef } from 'react';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { useSearchState, useSearchText } from '../../hooks/use-search-state.ts';
import { servicesText } from '../../i18n/catalog.ts';
import { useDeployOrPromote } from '../../parts/deploy-or-promote.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { ScreenFrame } from '../screen-frame.tsx';
import { ServicesTable } from './services-table.tsx';
import { byHealth, GROUPINGS, HEALTH_FILTERS, sectionsOf, type HealthFilter } from './shape.ts';
import { useServices } from './use-services.ts';

const HEALTH_WORD = {
  any: 'pipelinesServices.filter.healthAny',
  failing: 'pipelinesServices.health.failing',
  deploying: 'pipelinesServices.health.deploying',
  healthy: 'pipelinesServices.health.healthy',
} as const satisfies Record<HealthFilter, string>;

/**
 * Services: every service by domain (or team), the version running in each environment and
 * whether it is healthy. / filters, Enter on a row opens the service.
 */
export default function ServicesScreen() {
  const t = useT(servicesText);
  const navigate = useNavigate();
  const search = useRef<HTMLInputElement>(null);
  const [q, setQ] = useSearchText('q');
  const [team, setTeam] = useSearchText('team');
  const [domain] = useSearchText('domain');
  const [health, setHealth] = useSearchState('health', HEALTH_FILTERS, 'any');
  const [grouping, setGrouping] = useSearchState('by', GROUPINGS, 'domain');
  const list = useServices({
    ...(q ? { q } : {}),
    ...(team ? { team } : {}),
    ...(domain ? { domain } : {}),
  });
  const deploy = useDeployOrPromote();
  const data = list.data;
  const shown = data ? byHealth(data.items, health) : [];
  const sections = sectionsOf(shown, grouping, t('pipelinesServices.noTeam'));
  const filtered = Boolean(q || team || domain || health !== 'any');

  useShortcutHelp({
    id: 'pipelines.services',
    label: t('pipelinesServices.list.title'),
    keys: [{ keys: '/', label: t('pipelinesServices.list.filter') }],
  });
  useScreenKeys({ '/': () => search.current?.focus() });

  return (
    <ScreenFrame
      title={t('pipelinesServices.list.title')}
      meta={
        data
          ? t('pipelinesServices.list.meta', {
              count: formatNumber(data.total),
              domains: data.domains.filter((domain) => domain.count > 0).length,
            })
          : null
      }
      actions={
        <>
          <Button
            icon={<Icon name="branch" size={14} />}
            onClick={() => void navigate({ to: '/start' })}
          >
            {t('pipelinesServices.list.addFromGitHub')}
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="rocket" size={14} />}
            onClick={() => deploy.open({})}
          >
            {t('pipelinesServices.deploy')}
          </Button>
        </>
      }
    >
      <p className="-mt-2 text-13 text-tx-3">{t('pipelinesServices.list.lede')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          ref={search}
          value={q}
          onChange={(event) => setQ(event.target.value)}
          onKeyDown={(event) => event.key === 'Escape' && search.current?.blur()}
          placeholder={t('pipelinesServices.list.filter')}
          aria-label={t('pipelinesServices.list.filter')}
          hint="/"
          className="w-full sm:w-64"
        />
        <Select
          size="sm"
          aria-label={t('pipelinesServices.filter.team')}
          value={team}
          placeholder={t('pipelinesServices.filter.teamAny')}
          options={[
            { value: '', label: t('pipelinesServices.filter.teamAny') },
            ...(data?.teams ?? []).map((each) => ({ value: each.id, label: each.name })),
          ]}
          onChange={(event) => setTeam(event.value)}
        />
        <Select
          size="sm"
          aria-label={t('pipelinesServices.filter.health')}
          value={health}
          options={HEALTH_FILTERS.map((value) => ({ value, label: t(HEALTH_WORD[value]) }))}
          onChange={(event) => setHealth(event.value as HealthFilter)}
        />
        <SegmentedControl
          size="sm"
          className="ms-auto"
          aria-label={t('pipelinesServices.list.groupBy')}
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: 'domain', label: t('pipelinesServices.list.byDomain') },
            { value: 'team', label: t('pipelinesServices.list.byTeam') },
          ]}
        />
      </div>
      {list.isError ? (
        <LoadError
          title={t('pipelinesServices.list.loadFailed')}
          error={list.error}
          onRetry={() => void list.refetch()}
        />
      ) : !data ? (
        <RowsSkeleton rows={8} />
      ) : sections.length === 0 ? (
        <div className="rounded-card border border-line bg-card shadow-e1">
          <EmptyState
            icon={<Icon name="grid" size={18} />}
            title={
              filtered ? t('pipelinesServices.list.noMatch') : t('pipelinesServices.list.empty')
            }
            description={filtered ? undefined : t('pipelinesServices.list.emptyHint')}
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    setQ('');
                    setTeam('');
                    setHealth('any');
                  }}
                >
                  {t('pipelinesServices.list.clearFilters')}
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void navigate({ to: '/start' })}>
                  {t('pipelinesServices.list.addFromGitHub')}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ServicesTable
          sections={sections}
          environments={data.environments}
          onOpen={(row) => void navigate({ to: '/services/$key', params: { key: row.key } })}
        />
      )}
      {deploy.dialog}
    </ScreenFrame>
  );
}
