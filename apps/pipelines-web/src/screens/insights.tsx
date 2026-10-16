import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen, useScopeName } from './screen-frame.tsx';

export default function InsightsScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <PlannedScreen
      title={t('pipelines.insights.title')}
      icon="reports"
      description={t('pipelines.insights.description', { scope })}
    />
  );
}
