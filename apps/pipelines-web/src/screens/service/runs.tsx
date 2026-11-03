import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Runs tab (stream S5 builds it; placeholder until then). */
export default function ServiceRuns() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.runs')}
      icon="play"
      description={t('pipelinesServices.runs.planned')}
    />
  );
}
