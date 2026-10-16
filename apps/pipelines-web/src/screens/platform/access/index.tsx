import { useT } from '@bemmoly/core-web';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { PlannedScreen } from '../../screen-frame.tsx';

export default function Planned() {
  const t = useT(pipelinesText);
  return (
    <PlannedScreen
      title={t('pipelines.platform.access')}
      icon="lock"
      description={t('pipelines.screen.comingSoon')}
    />
  );
}
