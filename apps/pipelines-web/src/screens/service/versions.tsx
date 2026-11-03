import { useT } from '@bemmoly/core-web';
import { servicesText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A service's Versions tab (stream S5 builds it; placeholder until then). */
export default function ServiceVersions() {
  const t = useT(servicesText);
  return (
    <PlannedScreen
      title={t('pipelinesServices.tab.versions')}
      icon="tag"
      description={t('pipelinesServices.versions.planned')}
    />
  );
}
