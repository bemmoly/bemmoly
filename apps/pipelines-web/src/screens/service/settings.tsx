import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Settings tab (stream S5 builds it; placeholder until then). */
export default function ServiceSettings() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.settings')}
      icon="sliders"
      description={t('pipelinesServices.settings.planned')}
    />
  );
}
