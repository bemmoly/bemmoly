import { useT } from '@bemmoly/core-web';
import { useParams } from '@tanstack/react-router';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { PlannedScreen } from '../screen-frame.tsx';

/** One change request, by its number (stream S3 builds it; placeholder until then). */
export default function ChangeRequestScreen() {
  const t = useT(changeRequestsText);
  const { number = '' } = useParams({ strict: false }) as { number?: string };
  return (
    <PlannedScreen
      title={number}
      icon="checklist"
      description={t('pipelinesChangeRequests.detail.planned')}
    />
  );
}
