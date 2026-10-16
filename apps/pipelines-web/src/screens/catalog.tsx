import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen, useScopeName } from './screen-frame.tsx';

export default function CatalogScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <PlannedScreen
      title={t('pipelines.catalog.title')}
      icon="grid"
      description={t('pipelines.catalog.description', { scope })}
    />
  );
}
