import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen, useScopeName } from './screen-frame.tsx';

export default function MapScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <PlannedScreen
      title={t('pipelines.map.title')}
      icon="map"
      description={t('pipelines.map.description', { scope })}
    />
  );
}
