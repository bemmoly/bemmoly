import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen, useScopeName } from './screen-frame.tsx';

export default function ReleasesScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <PlannedScreen
      title={t('pipelines.releases.title')}
      icon="rocket"
      description={t('pipelines.releases.description', { scope })}
    />
  );
}
