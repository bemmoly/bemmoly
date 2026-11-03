import { useT } from '@bemmoly/core-web';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** A new change request (stream S3 builds it; placeholder until then). */
export default function NewChangeRequestScreen() {
  const t = useT(changeRequestsText);
  return (
    <PlannedScreen
      title={t('pipelinesChangeRequests.new.title')}
      icon="checklist"
      description={t('pipelinesChangeRequests.new.planned')}
    />
  );
}
