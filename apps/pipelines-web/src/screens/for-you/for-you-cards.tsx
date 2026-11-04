import { formatNumber, useT } from '@bemmoly/core-web';
import type { ForYouNeed, ForYouSummary } from '@bemmoly/module-pipelines/shared';
import { RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { forYouText, pipelinesText } from '../../i18n/catalog.ts';
import { currentGlyph, StateGlyph } from '../../parts/bits.tsx';

export const CARD =
  'flex min-w-0 flex-col gap-2 rounded-card border border-line bg-card px-4 py-3.5 shadow-e1';

const ROW =
  'flex items-center gap-3 border-b border-line-2 py-2.5 last:border-b-0 hover:bg-hover focus-ring-inset';

export function CardHead({ id, title, end }: { id: string; title: string; end?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="text-14 font-semibold text-tx">
        {title}
      </h2>
      {end ? <span className="ms-auto">{end}</span> : null}
    </div>
  );
}

function NeedRow({ need }: { need: ForYouNeed }) {
  const t = useT(forYouText);
  const p = useT(pipelinesText);
  if (need.kind === 'failed_run')
    return (
      <li>
        <Link to="/runs/$id" params={{ id: need.run.id }} className={ROW}>
          <StateGlyph state="failed" size={16} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-13 font-semibold text-tx">
              {need.service
                ? t('pipelinesForYou.needs.failedService', { service: need.service })
                : t('pipelinesForYou.needs.failed')}
            </span>
            <span className="truncate text-12 text-tx-3">
              {[
                p('pipelines.run.number', { number: formatNumber(need.run.number) }),
                need.run.title,
                need.commitSha.slice(0, 7),
              ].join(' · ')}
            </span>
          </span>
          <RelativeTime iso={need.at} className="text-12 text-tx-3" />
        </Link>
      </li>
    );
  return (
    <li>
      <Link to="/changes/$number" params={{ number: need.number }} className={ROW}>
        <StateGlyph state={need.status === 'deploying' ? 'running' : 'waiting'} size={16} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-13 font-semibold text-tx">
            {t(`pipelinesForYou.needs.change.${need.status}`, {
              number: need.number,
              left: Math.max(0, need.needed - need.approvals),
            })}
          </span>
          <span className="truncate text-12 text-tx-3">
            {t('pipelinesForYou.needs.changeDetail', {
              services: need.services.map((each) => `${each.key} ${each.version}`).join(', '),
              environment: need.environment,
            })}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** What waits on the person: their failed runs and their change requests under way. */
export function NeedsYou({ needs }: { needs: ForYouSummary['needsYou'] }) {
  const t = useT(forYouText);
  return (
    <section className={CARD} aria-labelledby="needs-you">
      <CardHead id="needs-you" title={t('pipelinesForYou.needs.title')} />
      {needs.length ? (
        <ul className="flex flex-col">
          {needs.map((need) => (
            <NeedRow key={need.kind === 'failed_run' ? need.run.id : need.number} need={need} />
          ))}
        </ul>
      ) : (
        <span className="py-2 text-13 text-tx-3">{t('pipelinesForYou.needs.none')}</span>
      )}
    </section>
  );
}

/** The person's services: the version in the last environment and a state per environment. */
export function YourServices({ summary }: { summary: ForYouSummary }) {
  const t = useT(forYouText);
  return (
    <section className={CARD} aria-labelledby="your-services">
      <CardHead
        id="your-services"
        title={t('pipelinesForYou.services.title')}
        end={
          <span className="text-12 text-tx-3">
            {summary.environments.map((environment) => environment.name).join(' · ')}
          </span>
        }
      />
      {summary.yourServices.length ? (
        <ul className="flex flex-col">
          {summary.yourServices.map((service) => (
            <li key={service.key}>
              <Link to="/services/$key" params={{ key: service.key }} className={ROW}>
                <Icon name="box" size={14} className="text-tx-3" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-13 font-semibold text-tx">
                    {service.key}
                  </span>
                  <span className="truncate text-12 text-tx-3">
                    {[
                      service.domain,
                      summary.lastEnvironment
                        ? t('pipelinesForYou.services.inLast', {
                            environment: summary.lastEnvironment.name,
                            version: service.lastVersion ?? t('pipelinesForYou.services.notYet'),
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="flex gap-1">
                  {service.states.map((state) => (
                    <StateGlyph
                      key={state.environment}
                      state={state.state ? currentGlyph(state.state) : 'queued'}
                      size={12}
                    />
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <span className="py-2 text-13 text-tx-3">{t('pipelinesForYou.services.none')}</span>
      )}
    </section>
  );
}
