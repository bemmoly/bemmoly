import { useT } from '@bemmoly/core-web';
import { Skeleton } from '@bemmoly/ui';
import { useEnvironmentsV2 } from '../../../hooks/use-environments-v2.ts';
import { useMe } from '../../../hooks/use-me.ts';
import { useChecklist } from '../../../hooks/use-setup.ts';
import { setupText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { ScreenFrame } from '../../screen-frame.tsx';
import { ChecklistCard } from './checklist-card.tsx';
import { SwitchedOn } from './switched-on.tsx';

/**
 * For you on a fresh install (product rule 2): the setup checklist beside "What's switched on".
 * For you mounts this while the checklist is not done.
 */
export function SetupHome() {
  const t = useT(setupText);
  const me = useMe().data;
  const checklist = useChecklist();
  const environments = useEnvironmentsV2();
  const first = me?.user.name.split(' ')[0] ?? '';
  return (
    <ScreenFrame
      title={t('pipelinesSetup.home.title', { name: first })}
      heading={
        <div className="flex flex-col gap-1">
          <span className="text-11 font-semibold tracking-wide text-tx-3 uppercase">
            {t('pipelinesSetup.home.eyebrow')}
          </span>
          <h1 className="text-20 leading-title font-semibold text-tx">
            {t('pipelinesSetup.home.title', { name: first })}
          </h1>
          <span className="text-13 text-tx-2">{t('pipelinesSetup.home.intro')}</span>
        </div>
      }
    >
      {checklist.isError ? (
        <LoadFailed error={checklist.error} onRetry={() => void checklist.refetch()} />
      ) : !checklist.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ChecklistCard steps={checklist.data.steps} />
          <SwitchedOn
            summary={checklist.data.switchedOn}
            environments={environments.data?.items ?? []}
          />
        </div>
      )}
    </ScreenFrame>
  );
}
