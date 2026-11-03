import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** Services: every service by domain (stream S5 builds it; placeholder until then). */
export default function ServicesScreen() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.list.title')}
      icon="grid"
      description={t('pipelinesServices.list.planned')}
    />
  );
}
