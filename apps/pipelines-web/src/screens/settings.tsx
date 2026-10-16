import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen } from './screen-frame.tsx';

export default function SettingsScreen() {
  const t = useT(pipelinesText);
  return (
    <PlannedScreen
      title={t('pipelines.settings.title')}
      icon="gear"
      description={t('pipelines.settings.description')}
    />
  );
}
