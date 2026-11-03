import { useT } from '@bemmoly/core-web';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** Changes: the change request list (stream S3 builds it; placeholder until then). */
export default function ChangeRequestsScreen() {
  const t = useT(changeRequestsText);
  return (
    <PlannedScreen
      title={t('pipelinesChangeRequests.list.title')}
      icon="checklist"
      description={t('pipelinesChangeRequests.list.planned')}
    />
  );
}
