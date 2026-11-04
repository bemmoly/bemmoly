import { useT } from '@bemmoly/core-web';
import { personRoleSchema, type PersonRole } from '@bemmoly/module-pipelines/shared';
import { Card } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { rolesText } from '../../../i18n/catalog.ts';

export const ROLE_ICONS: Record<PersonRole, IconName> = {
  platform_admin: 'gear',
  developer: 'code',
  approver: 'checklist',
  viewer: 'eye',
};

/** The four roles side by side, each with what it sees and may do. */
export function RoleCards() {
  const t = useT(rolesText);
  return (
    <ul
      aria-label={t('pipelinesRoles.roleCards')}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      {personRoleSchema.options.map((role) => (
        <li key={role}>
          <Card className="flex h-full flex-col gap-1.5 p-4">
            <span className="flex items-center gap-2 text-13 font-semibold text-tx">
              <Icon name={ROLE_ICONS[role]} size={14} />
              {t(`pipelinesRoles.role.${role}`)}
            </span>
            <span className="text-13 leading-body text-tx-2">
              {t(`pipelinesRoles.roleCard.${role}`)}
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
