import { useT } from '@bemmoly/core-web';
import { environmentsText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** Environments: the one ordered path (stream S2 builds it; placeholder until then). */
export default function EnvironmentsScreen() {
  const t = useT(environmentsText);
  return (
    <PlannedScreen
      title={t('pipelinesEnvironments.list.title')}
      icon="layers"
      description={t('pipelinesEnvironments.list.planned')}
    />
  );
}
