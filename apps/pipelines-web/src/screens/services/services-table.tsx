import { useT } from '@bemmoly/core-web';
import type { ServiceEnvironment, ServiceRow } from '@bemmoly/module-pipelines/shared';
import { EntityTile, entityHue, Table, type EntityHue, type TableColumn } from '@bemmoly/ui';
import { pipelinesText, servicesText } from '../../i18n/catalog.ts';
import { RUNTIME_WORD, StateGlyph } from '../../parts/bits.tsx';
import { runGlyph } from '../../parts/run-line.tsx';
import { RunningCell } from './running-cell.tsx';
import type { Section } from './shape.ts';

function useColumns(environments: readonly ServiceEnvironment[]): TableColumn<ServiceRow>[] {
  const t = useT(servicesText);
  const p = useT(pipelinesText);
  return [
    {
      key: 'service',
      header: t('pipelinesServices.column.service'),
      width: 'minmax(220px,2fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-13 font-semibold text-tx">{row.key}</span>
          <span className="truncate text-12 text-tx-3">
            {[p(RUNTIME_WORD[row.kind]), row.path].filter(Boolean).join(' · ')}
          </span>
        </span>
      ),
    },
    {
      key: 'team',
      header: t('pipelinesServices.column.team'),
      width: 'minmax(100px,1fr)',
      hideOnPhone: true,
      render: (row) => (
        <span className="truncate text-13 text-tx-2">
          {row.team?.name ?? t('pipelinesServices.noTeam')}
        </span>
      ),
    },
    ...environments.map((environment): TableColumn<ServiceRow> => ({
      key: `env-${environment.key}`,
      header: environment.name,
      width: 'minmax(150px,1.3fr)',
      hideOnPhone: environment !== environments[0],
      render: (row) => (
        <RunningCell
          running={row.running.find((running) => running.environment === environment.key)}
        />
      ),
    })),
    {
      key: 'last-run',
      header: t('pipelinesServices.column.lastRun'),
      width: '80px',
      align: 'center',
      render: (row) =>
        row.lastRun ? (
          <StateGlyph state={runGlyph(row.lastRun.state)} />
        ) : (
          <span className="text-12 text-tx-3">{t('pipelinesServices.none')}</span>
        ),
    },
  ];
}

/**
 * Services in sections, a domain's (or a team's) tile and name over its own rows, every
 * section with the same columns so the environments line up down the page.
 */
export function ServicesTable({
  sections,
  environments,
  onOpen,
}: {
  sections: readonly Section[];
  environments: readonly ServiceEnvironment[];
  onOpen: (service: ServiceRow) => void;
}) {
  const t = useT(servicesText);
  const columns = useColumns(environments);
  return (
    <div className="flex flex-col gap-5">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`section-${section.key}`}>
          <div className="mb-2 flex items-center gap-2">
            <EntityTile
              name={section.name}
              hue={(section.hue as EntityHue | null) ?? entityHue(section.name)}
              size={18}
            />
            <h2 id={`section-${section.key}`} className="text-14 font-semibold text-tx">
              {section.name}
            </h2>
            <span className="text-12 text-tx-3">
              {t('pipelinesServices.list.sectionCount', { count: section.items.length })}
            </span>
          </div>
          <Table
            label={t('pipelinesServices.list.tableLabel', { section: section.name })}
            columns={columns}
            rows={section.items}
            rowKey={(row) => row.key}
            onRowClick={onOpen}
          />
        </section>
      ))}
    </div>
  );
}
