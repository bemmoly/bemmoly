import { useT } from '@bemmoly/core-web';
import type { PersonRole } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { pipelinesText, rolesText } from '../../i18n/catalog.ts';
import type { Place } from '../../shell/places.ts';

const ADMIN_PLACES: ReadonlySet<Place['id']> = new Set(['environments', 'platform']);

/** A place the person's role does not show: say whose it is, and the way back. */
export function NotInViewScreen({
  name,
  role,
  place,
}: {
  name: string;
  role: PersonRole;
  place: Place;
}) {
  const t = useT(rolesText);
  const shell = useT(pipelinesText);
  const navigate = useNavigate();
  return (
    <div className="grid min-h-full place-items-center px-4 py-16">
      <EmptyState
        icon={<Icon name="eye-off" size={18} />}
        title={t('pipelinesRoles.notInView.title')}
        description={t('pipelinesRoles.notInView.body', {
          name,
          role: t(`pipelinesRoles.article.${role}`),
          place: shell(`pipelines.shell.place.${place.id}`),
          who: ADMIN_PLACES.has(place.id)
            ? t('pipelinesRoles.notInView.admins')
            : t('pipelinesRoles.notInView.builders'),
        })}
        headingLevel={1}
        action={
          <Button variant="secondary" onClick={() => void navigate({ to: '/' })}>
            {t('pipelinesRoles.notInView.back')}
          </Button>
        }
      />
    </div>
  );
}

/** Signed in with Pipelines granted, but no role yet: nothing to show until an admin invites. */
export function NotInvitedScreen() {
  const t = useT(rolesText);
  return (
    <div className="grid min-h-full place-items-center px-4 py-16">
      <EmptyState
        icon={<Icon name="lock" size={18} />}
        title={t('pipelinesRoles.notInvited.title')}
        description={t('pipelinesRoles.notInvited.body')}
        headingLevel={1}
      />
    </div>
  );
}
