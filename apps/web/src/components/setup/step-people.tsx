import { Badge, Button, Card } from '@bemmoly/ui';
import { SSO_NOTE, SSO_OPTIONS, useSetupInvites } from '../../hooks/use-setup-invites.ts';
import { Notice } from '../form.tsx';
import { BrandTile } from './choice-card.tsx';
import { InviteByEmail } from './invite-by-email.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** The two single sign-on cards from the mock, shown but switched off. */
function SsoCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SSO_OPTIONS.map((option, index) => (
        <Card key={option.id} className="flex flex-col gap-2 p-4" aria-disabled="true">
          <span className="flex items-center gap-2.5">
            <BrandTile initials={option.initials} />
            <span className="text-14 font-semibold">{option.name}</span>
            {option.badge ? (
              <Badge tone="ok" className="ml-auto">
                {option.badge}
              </Badge>
            ) : null}
          </span>
          <span className="text-12h leading-body text-tx4">{option.description}</span>
          <Button
            variant={index === 0 ? 'primary' : 'secondary'}
            size="sm"
            disabled
            className="mt-1 self-start"
          >
            {option.action}
          </Button>
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
