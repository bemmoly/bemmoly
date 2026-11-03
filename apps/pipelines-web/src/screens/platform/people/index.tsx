import { useT } from '@bemmoly/core-web';
import { rolesText } from '../../../i18n/catalog.ts';
import { PlannedScreen } from '../../screen-frame.tsx';

/** Platform › People and roles (stream S1 builds it; placeholder until then). */
export default function PeopleScreen() {
  const t = useT(rolesText);
  return (
    <PlannedScreen
      title={t('pipelinesRoles.people.title')}
      icon="user"
      description={t('pipelinesRoles.people.planned')}
    />
  );
}
