import { useT } from '@bemmoly/core-web';
import type { ServiceEnvironment, ServiceRunning } from '@bemmoly/module-pipelines/shared';
import { Badge, Button, ProgressBar, RelativeTime } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { servicesText } from '../../i18n/catalog.ts';
import { currentGlyph, StateGlyph } from '../../parts/bits.tsx';
import { HEALTH_WORD, shownVersion } from '../services/running-cell.tsx';
import { CARD, cloudRunUrl } from './card.ts';

const TONE = {
  idle: 'ok',
  deploying: 'accent',
  canary: 'accent',
  waiting: 'warn',
  failed: 'danger',
  rolled_back: 'danger',
} as const;

/** "Change request": versions reach this environment through one. Never a shield or a class. */
function RuleBadge({ environment }: { environment: ServiceEnvironment }) {
  const t = useT(servicesText);
  return environment.hasApprovalRule ? (
    <Badge className="inline-flex items-center gap-1">
      <Icon name="checklist" size={12} />
      {t('pipelinesServices.overview.changeRequest')}
    </Badge>
  ) : null;
}

/**
 * One environment on the Overview lane: the version running there and how it is doing, who
 * deployed it, any change request moving a newer one, and the way to open it in the cloud.
 */
export function EnvironmentCard({
  service,
  environment,
  running,
  onDeploy,
}: {
  service: string;
  environment: ServiceEnvironment;
  running: ServiceRunning | undefined;
  onDeploy: () => void;
}) {
  const t = useT(servicesText);
  const where = [environment.project, environment.region].filter(Boolean).join(' · ');
  const console = cloudRunUrl(environment.project, environment.region, service);
  if (!running?.version && !running?.movingVersion)
    return (
      <section aria-label={environment.name} className={`${CARD} min-w-56 flex-1 basis-0`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-14 font-semibold text-tx">{environment.name}</h2>
          <RuleBadge environment={environment} />
        </div>
        <span className="text-13 text-tx-3">{t('pipelinesServices.overview.notYet')}</span>
        {where ? <span className="font-mono text-12 text-tx-3">{where}</span> : null}
        <div>
          <Button size="sm" icon={<Icon name="rocket" size={14} />} onClick={onDeploy}>
            {t('pipelinesServices.overview.deployTo', { environment: environment.name })}
          </Button>
        </div>
      </section>
    );
  const moving = running.state === 'canary' && running.trafficPercent < 100;
  return (
    <section aria-label={environment.name} className={`${CARD} min-w-56 flex-1 basis-0`}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-14 font-semibold text-tx">{environment.name}</h2>
        <RuleBadge environment={environment} />
        <Badge tone={TONE[running.state]} className="ms-auto inline-flex items-center gap-1">
          <StateGlyph state={currentGlyph(running.state)} size={12} />
          {t(HEALTH_WORD[running.state])}
        </Badge>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-20 leading-title font-semibold text-tx">
          {shownVersion(running)}
        </span>
        <span className="truncate text-12 text-tx-3">
          {[running.commitSha?.slice(0, 7), running.message].filter(Boolean).join(' · ')}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-12">
        <dt className="text-tx-3">{t('pipelinesServices.overview.deployed')}</dt>
        <dd className="truncate text-tx-2">
          {running.deployedAt ? <RelativeTime iso={running.deployedAt} /> : null}
          {running.deployedBy
            ? ` ${t('pipelinesServices.overview.by', { name: running.deployedBy })}`
            : null}
        </dd>
        {environment.project ? (
          <>
            <dt className="text-tx-3">{t('pipelinesServices.overview.project')}</dt>
            <dd className="truncate font-mono text-tx-2">{environment.project}</dd>
          </>
        ) : null}
      </dl>
      {moving ? (
        <div className="flex flex-col gap-1">
          <span className="text-12 text-tx-3">
            {t('pipelinesServices.overview.traffic', {
              percent: running.trafficPercent,
              version: running.movingVersion ?? '',
            })}
          </span>
          <ProgressBar
            value={running.trafficPercent}
            label={t('pipelinesServices.overview.trafficLabel')}
          />
        </div>
      ) : null}
      {running.pending ? (
        <Link
          to="/changes/$number"
          params={{ number: running.pending.number }}
          className="flex items-center gap-2 rounded-control bg-sunken px-2.5 py-2 text-12 text-tx-2 hover:bg-hover focus-ring"
        >
          <Icon name="checklist" size={14} />
          <span className="flex-1">
            {t('pipelinesServices.overview.inChange', { number: running.pending.number })}
          </span>
          <span className="text-tx-3">
            {t('pipelinesServices.change.approvals', {
              approvals: running.pending.approvals,
              needed: running.pending.needed,
            })}
          </span>
        </Link>
      ) : null}
      {console ? (
        <div>
          <a
            href={console}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-12 text-acc hover:text-acc-600 focus-ring"
          >
            <Icon name="link" size={14} />
            {t('pipelinesServices.overview.openInCloud')}
          </a>
        </div>
      ) : null}
    </section>
  );
}
