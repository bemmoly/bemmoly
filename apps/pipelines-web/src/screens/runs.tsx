import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../i18n/catalog.ts';
import { PlannedScreen, useScopeName } from './screen-frame.tsx';

export default function RunsScreen() {
  const t = useT(pipelinesText);
  const scope = useScopeName();
  return (
    <PlannedScreen
      title={t('pipelines.runs.title')}
      icon="play"
      description={t('pipelines.runs.description', { scope })}
    />
  );
}
