import { useT } from '@bemmoly/core-web';
import type { SettingOrigin } from '@bemmoly/module-pipelines/shared';
import { Badge, Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { SIDE_CARD } from './side-cards.tsx';

const ORIGINS: readonly SettingOrigin[] = ['file', 'central', 'defaults'];

const ORIGIN_WORD = {
  file: 'pipelines.settingsFrom.fromFile',
  central: 'pipelines.settingsFrom.fromCentral',
  defaults: 'pipelines.settingsFrom.fromDefaults',
} as const satisfies Record<SettingOrigin, string>;

/**
 * Where an application's settings come from in its repository: its own application.yaml, its
 * entry in the repository file's central list, or the repository file's defaults. A library
 * (a pipeline that only checks) says so here, since it never shows a release. Nothing shows
 * for an application made in Pipelines that is not a library.
 */
export function SettingsCard({ application }: { application: string }) {
  const t = useT(pipelinesText);
  const pipeline = useQuery({
    queryKey: deliveryKeys.pipeline(application),
    queryFn: () => api.delivery.applicationPipeline(application),
  });
  if (pipeline.isError) {
    return (
      <section className={SIDE_CARD}>
        <LoadFailed bare size="sm" error={pipeline.error} onRetry={() => void pipeline.refetch()} />
      </section>
    );
  }
  if (!pipeline.data) {
    return (
      <section className={SIDE_CARD}>
        <Skeleton width="50%" height={14} />
      </section>
    );
  }
  const { settings, library } = pipeline.data;
  if (!settings && !library) return null;
  const fields = Object.entries(settings?.fields ?? {});
  return (
    <section className={SIDE_CARD} aria-labelledby="settings-heading" data-testid="settings-card">
      <div className="flex items-center gap-2">
        <h2 id="settings-heading" className="text-16 leading-title font-semibold text-tx">
          {t('pipelines.settingsFrom.title')}
        </h2>
        {library ? <Badge tone="accent">{t('pipelines.settingsFrom.library')}</Badge> : null}
      </div>
      {library ? (
        <p className="text-12 text-tx-2">{t('pipelines.settingsFrom.libraryNote')}</p>
      ) : null}
      {settings ? (
        <dl>
          <div className="flex min-w-0 items-center gap-2 py-1 text-12">
            <dt className="w-21 shrink-0 text-tx-3">{t('pipelines.settingsFrom.definedIn')}</dt>
            <dd className="min-w-0 truncate font-mono text-tx">{settings.file}</dd>
          </div>
          {ORIGINS.map((origin) => {
            const names = fields.filter(([, from]) => from === origin).map(([name]) => name);
            if (names.length === 0) return null;
            return (
              <div key={origin} className="flex min-w-0 items-start gap-2 py-1 text-12">
                <dt className="w-21 shrink-0 text-tx-3">{t(ORIGIN_WORD[origin])}</dt>
                <dd className="min-w-0 text-tx">{names.sort().join(', ')}</dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </section>
  );
}
