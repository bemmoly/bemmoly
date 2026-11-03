import { useT } from '@bemmoly/core-web';
import { buttonClassName, EmptyState, SegmentedControl, Skeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { Link } from '@tanstack/react-router';
import { useSearchText } from '../../hooks/use-search-state.ts';
import { servicesText } from '../../i18n/catalog.ts';
import { CARD, cloudLoggingUrl } from './card.ts';
import { useService, useServiceKey } from './use-service.ts';

/**
 * Logs: the service's logs in one environment. They live in the environment's own cloud
 * project, so this opens Cloud Logging filtered to the service rather than copying them here.
 */
export default function ServiceLogs() {
  const t = useT(servicesText);
  const key = useServiceKey();
  const service = useService(key);
  const [chosen, setChosen] = useSearchText('env');
  const environments = service.data?.environments ?? [];
  const environment =
    environments.find((each) => each.key === chosen) ?? environments.at(-1) ?? null;
  const url = environment ? cloudLoggingUrl(environment.project, key) : null;
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      {!service.data ? (
        <Skeleton width={260} height={28} />
      ) : environment ? (
        <SegmentedControl
          size="sm"
          aria-label={t('pipelinesServices.logs.environment')}
          value={environment.key}
          onChange={setChosen}
          options={environments.map((each) => ({ value: each.key, label: each.name }))}
        />
      ) : null}
      <div className={CARD}>
        {!service.data ? (
          <Skeleton width="60%" height={14} />
        ) : !environment ? (
          <EmptyState
            icon={<Icon name="layers" size={18} />}
            title={t('pipelinesServices.overview.noEnvironments')}
            description={t('pipelinesServices.overview.noEnvironmentsHint')}
          />
        ) : url ? (
          <EmptyState
            icon={<Icon name="list" size={18} />}
            headingLevel={2}
            title={t('pipelinesServices.logs.title', { environment: environment.name })}
            description={t('pipelinesServices.logs.inCloud', {
              service: key,
              project: environment.project ?? '',
            })}
            action={
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={buttonClassName({ variant: 'primary' })}
              >
                <Icon name="link" size={14} />
                {t('pipelinesServices.logs.open')}
              </a>
            }
          />
        ) : (
          <EmptyState
            icon={<Icon name="cloud-off" size={18} />}
            headingLevel={2}
            title={t('pipelinesServices.logs.noProject', { environment: environment.name })}
            description={t('pipelinesServices.logs.noProjectHint')}
            action={
              <Link to="/environments" className={buttonClassName({})}>
                {t('pipelinesServices.logs.linkProject')}
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
