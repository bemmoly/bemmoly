import { Card } from '@bemmoly/ui';
import { SSO_NOTE, SSO_OPTIONS, useSetupInvites } from '../../hooks/use-setup-invites.ts';
import { Notice } from '../form.tsx';
import { BrandTile, COMING_SOON_MUTE, ComingSoonBadge } from './choice-card.tsx';
import { InviteByEmail } from './invite-by-email.tsx';
import { SSO_MARKS } from './option-marks.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** The two single sign-on cards from the mock, with their logos, marked coming soon. */
function SsoCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SSO_OPTIONS.map((option) => (
        <Card key={option.id} className="flex flex-col gap-2 p-4" aria-disabled="true">
          <span className="flex items-center gap-2.5">
            <span className={`flex items-center gap-2.5 ${COMING_SOON_MUTE}`}>
              <BrandTile initials={option.initials} icon={SSO_MARKS[option.id]} />
              <span className="text-14 font-semibold">{option.name}</span>
            </span>
            <ComingSoonBadge />
          </span>
          <span className={`text-12h leading-body text-tx4 ${COMING_SOON_MUTE}`}>
            {option.description}
          </span>
        </Card>
      ))}
    </div>
  );
}

/** Step 3: SSO cards (off), then the invite-by-email card. */
export function StepPeople({ nav }: { nav: StepNav }) {
  const invites = useSetupInvites(nav.next);
  return (
    <>
      <SsoCards />
      <Notice>{SSO_NOTE}</Notice>
      <InviteByEmail invites={invites} />
      <StepFooter nav={nav} onPrimary={invites.submit} loading={invites.mutation.isPending} />
    </>
  );
}
