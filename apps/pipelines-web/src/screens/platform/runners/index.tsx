import { useT } from '@bemmoly/core-web';
import { runsText } from '../../../i18n/catalog.ts';
import { PlannedScreen } from '../../screen-frame.tsx';

/** Platform › Runners (stream S4 builds it; placeholder until then). */
export default function RunnersScreen() {
  const t = useT(runsText);
  return (
    <PlannedScreen
      title={t('pipelinesRuns.runners.title')}
      icon="server"
      description={t('pipelinesRuns.runners.planned')}
    />
  );
}
