import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Logs tab (stream S5 builds it; placeholder until then). */
export default function ServiceLogs() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.logs')}
      icon="list"
      description={t('pipelinesServices.logs.planned')}
    />
  );
}
