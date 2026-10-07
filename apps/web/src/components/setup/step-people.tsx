import { Badge, Button, Card, controlClass, Select, Tag } from '@bemmoly/ui';
import {
  EMAIL_NOTE,
  PASTE_PLACEHOLDER,
  SSO_NOTE,
  SSO_OPTIONS,
  useSetupInvites,
} from '../../hooks/use-setup-invites.ts';
import { Notice } from '../form.tsx';
import { InitialsTile } from './choice-card.tsx';
import { StepFooter, type StepNav } from './step-footer.tsx';

/** The two single sign-on cards from the mock, shown but switched off. */
function SsoCards() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {SSO_OPTIONS.map((option, index) => (
        <Card key={option.id} className="flex flex-col gap-2 p-4" aria-disabled="true">
          <span className="flex items-center gap-2.5">
            <InitialsTile text={option.initials} />
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

/** Step 3: SSO cards (off), then email chips with a role and a team. */
export function StepPeople({ nav }: { nav: StepNav }) {
  const invites = useSetupInvites(nav.next);
  return (
    <>
      <SsoCards />
      <Notice>{SSO_NOTE}</Notice>
      <Card className="flex flex-col gap-3 p-5">
        <span className="font-semibold">Or invite by email</span>
        <div
          className={`flex min-h-20 flex-wrap content-start gap-1.5 bg-sf px-3 py-2.5 ${controlClass}`}
        >
          {invites.emails.map((email) => (
            <Tag key={email} size="lg" onRemove={() => invites.remove(email)}>
              {email}
            </Tag>
          ))}
          <input
            aria-label="Email addresses"
            value={invites.text}
            placeholder={PASTE_PLACEHOLDER}
            onChange={(event) => invites.change(event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              invites.paste(event.clipboardData.getData('text'));
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              invites.change(`${invites.text}\n`);
            }}
            onBlur={() => invites.text && invites.change(`${invites.text} `)}
            className="h-6.5 min-w-60 flex-1 border-0 bg-transparent p-0 font-sans text-12h text-tx outline-0 placeholder:text-tx5"
          />
        </div>
        {invites.error ? (
          <span role="alert" className="text-12 text-danger">
            {invites.error}
          </span>
        ) : null}
        <div className="flex items-center gap-3 text-12h">
          <span className="text-tx4">Role</span>
          <Select
            size="sm"
            aria-label="Role"
            options={invites.roleOptions}
            value={invites.roleId ?? ''}
            disabled={invites.loading}
            onChange={(event) => invites.setRoleId(event.target.value)}
          />
          <span className="text-tx4">Team</span>
          <Select
            size="sm"
            aria-label="Team"
            options={invites.teamOptions}
            value={invites.teamId ?? ''}
            onChange={(event) => invites.setTeamId(event.target.value)}
          />
          <span className="ml-auto text-tx5">{EMAIL_NOTE}</span>
        </div>
      </Card>
      <StepFooter nav={nav} onPrimary={invites.submit} loading={invites.mutation.isPending} />
    </>
  );
}
