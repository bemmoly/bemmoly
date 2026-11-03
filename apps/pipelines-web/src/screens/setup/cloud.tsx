import { useT } from '@bemmoly/core-web';
import { setupText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** Connect a cloud, a setup checklist step (stream S2 builds it; placeholder until then). */
export default function ConnectCloudScreen() {
  const t = useT(setupText);
  return (
    <PlannedScreen
      title={t('pipelinesSetup.cloud.title')}
      icon="cloud"
      description={t('pipelinesSetup.cloud.planned')}
    />
  );
}
