import { SSO_NOTE, SSO_OPTIONS, useSetupInvites } from '../../hooks/use-setup-invites.ts';
import { InviteLinks } from '../people/invite-links.tsx';
import { BrandTile, COMING_SOON_MUTE, ComingSoonBadge } from './choice-card.tsx';
import { InviteByEmail } from './invite-by-email.tsx';
import { SSO_MARKS } from './option-marks.tsx';
import { StepFooter, StepForm, type StepNav } from './step-footer.tsx';

/** The two single sign-on options, as one quiet row each, marked coming soon. */
function SsoRows() {
  return (
    <section aria-labelledby="setup-sso" className="flex flex-col gap-2">
      <h2 id="setup-sso" className="m-0 text-13 font-semibold text-tx">
        Single sign-on
      </h2>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {SSO_OPTIONS.map((option) => (
          <li
            key={option.id}
            aria-disabled="true"
            title={option.description}
            className="flex items-center gap-2.5 rounded-card border border-line bg-card px-3 py-2.5"
          >
            <span className={`flex min-w-0 items-center gap-2.5 ${COMING_SOON_MUTE}`}>
              <BrandTile initials={option.initials} icon={SSO_MARKS[option.id]} />
              <span className="truncate text-13 font-medium text-tx">{option.name}</span>
            </span>
            <ComingSoonBadge />
          </li>
        ))}
      </ul>
      <p className="m-0 text-12 text-tx-3">{SSO_NOTE}</p>
    </section>
  );
}

function sendLabel(count: number): string {
  if (count === 0) return 'Continue';
  return count === 1 ? 'Send 1 invitation' : `Send ${count} invitations`;
}

/**
 * People: invite by email first (the thing that works today), then single sign-on, coming
 * soon. The primary says what it will do: send the invitations, or just continue.
 */
export function StepPeople({ nav }: { nav: StepNav }) {
  const invites = useSetupInvites(nav.next);
  const pending = invites.emails.length + (invites.text.trim() ? 1 : 0);
  return (
    <StepForm
      label="People"
      onSubmit={invites.issued ? invites.finish : invites.submit}
      busy={invites.mutation.isPending}
    >
      <InviteByEmail invites={invites} />
      {invites.issued ? (
        <section aria-labelledby="setup-issued" className="flex flex-col gap-3">
          <h2 id="setup-issued" className="m-0 text-13 font-semibold text-tx">
            Invitations sent
          </h2>
          <InviteLinks
            links={invites.issued.items}
            emailConfigured={invites.issued.emailConfigured}
          />
        </section>
      ) : (
        <SsoRows />
      )}
      <StepFooter
        nav={nav}
        label={invites.issued ? 'Continue' : sendLabel(pending)}
        loading={invites.mutation.isPending}
      />
    </StepForm>
  );
}
