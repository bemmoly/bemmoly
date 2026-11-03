import { useT } from '@bemmoly/core-web';
import { environmentsText } from '../../../i18n/catalog.ts';
import { PlannedScreen } from '../../screen-frame.tsx';

/** Platform › Approval rules (stream S2 builds it; placeholder until then). */
export default function ApprovalRulesScreen() {
  const t = useT(environmentsText);
  return (
    <PlannedScreen
      title={t('pipelinesEnvironments.approvals.title')}
      icon="checklist"
      description={t('pipelinesEnvironments.approvals.planned')}
    />
  );
}
