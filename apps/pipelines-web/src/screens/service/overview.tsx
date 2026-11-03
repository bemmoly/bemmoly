import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Overview tab (stream S5 builds it; placeholder until then). */
export default function ServiceOverview() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.overview')}
      icon="grid"
      description={t('pipelinesServices.overview.planned')}
    />
  );
}
