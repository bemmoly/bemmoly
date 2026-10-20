import type { Translate } from '@bemmoly/core-web';
import type { ProvisionState, ProvisionStep } from '@bemmoly/ui';
import type { pipelinesText } from '../../i18n/catalog.ts';
import type { Discovery } from './use-discovery.ts';

type T = Translate<Parameters<typeof pipelinesText.t>[0]>;
type StepView = Pick<ProvisionStep, 'state' | 'description' | 'action'>;

/**
 * Step 2 follows discovery: running with its progress, the proposals once there are some,
 * or what it looked through with Scan again when it found nothing.
 */
export function applicationsView(
  t: T,
  state: ProvisionState,
  proposals: number,
  discovery: Discovery,
  action: (label: string, onClick: () => void) => ProvisionStep['action'],
): StepView {
  if (proposals > 0) {
    return {
      state,
      description: t('pipelines.start.applicationsFound', { count: proposals }),
      action: action(t('pipelines.start.review'), () =>
        document.getElementById('proposals')?.scrollIntoView({ behavior: 'smooth' }),
      ),
    };
  }
  const status = discovery.status;
  if (state !== 'current' || !status) {
    return { state, description: t('pipelines.start.applicationsDescription') };
  }
  if (discovery.scanning || !status.lastSweep) {
    return {
      state: 'working',
      description:
        status.repositories > 0
          ? t('pipelines.start.applicationsScanning', {
              scanned: status.scanned + status.failed,
              total: status.repositories,
            })
          : t('pipelines.start.applicationsListing'),
    };
  }
  const again = action(t('pipelines.start.scanAgain'), discovery.scanAgain);
  if (status.lastSweep.error && status.repositories === 0) {
    return { state: 'failed', description: status.lastSweep.error, action: again };
  }
  const unread =
    status.failed > 0
      ? ` ${t('pipelines.start.applicationsUnread', { count: status.failed })}`
      : '';
  return {
    state,
    description: `${t('pipelines.start.applicationsNone', { count: status.repositories })}${unread}`,
    action: again,
  };
}
