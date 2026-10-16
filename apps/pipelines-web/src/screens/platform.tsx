import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen } from './screen-frame.tsx';

export default function PlatformScreen() {
  const t = useT(pipelinesText);
  return (
    <PlannedScreen
      title={t('pipelines.platform.title')}
      icon="server"
      description={t('pipelines.platform.description')}
    />
  );
}
