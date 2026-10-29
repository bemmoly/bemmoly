import { useT } from '@bemmoly/core-web';
import { Badge } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { JourneyTemplate } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useOrgLookups } from '../shared/queries.ts';
import { SettingsList } from './settings-list.tsx';
import { TemplateDialog } from './template-dialog.tsx';

/** Onboarding and offboarding templates; the most specific one starts for each person. */
export function JourneysTab() {
  const t = useT(peopleText);
  const org = useOrgLookups();
  const query = useQuery({
    queryKey: peopleKeys.templates(),
    queryFn: async () => (await api.people.journeys.templates()).items,
  });
  const [open, setOpen] = useState<JourneyTemplate | 'new' | null>(null);
  return (
    <>
      <SettingsList
        label={t('people.settings.journeys')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyTemplates')}
        onAdd={() => setOpen('new')}
        onOpen={setOpen}
        columns={[
          {
            key: 'name',
            header: t('people.settings.name'),
            width: 'minmax(180px,2fr)',
            render: (row) => (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-13 font-semibold">{row.name}</span>
                {row.archived ? (
                  <Badge tone="outline">{t('people.settings.archivedBadge')}</Badge>
                ) : null}
              </span>
            ),
          },
          {
            key: 'kind',
            header: t('people.settings.kind'),
            width: '120px',
            render: (row) => (
              <span className="text-13 text-tx-2">{t(`people.journeys.${row.kind}`)}</span>
            ),
          },
          {
            key: 'for',
            header: t('people.settings.location'),
            width: 'minmax(140px,1fr)',
            hideOnPhone: true,
            render: (row) => (
              <span className="truncate text-13 text-tx-2">
                {[
                  org.location(row.locationId)?.name ?? t('people.settings.everywhere'),
                  row.jobTitle ?? t('people.settings.anyTitle'),
                ].join(' · ')}
              </span>
            ),
          },
          {
            key: 'tasks',
            header: t('people.settings.tasks'),
            width: '100px',
            align: 'end',
            render: (row) => (
              <span className="text-13 tabular-nums">
                {t('people.settings.taskCount', { count: row.tasks.length })}
              </span>
            ),
          },
        ]}
      />
      {open ? (
        <TemplateDialog template={open === 'new' ? null : open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
