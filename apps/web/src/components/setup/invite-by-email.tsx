import { Card, controlClass, Select, Tag } from '@bemmoly/ui';
import { useId } from 'react';
import {
  EMAIL_NOTE,
  INVITE_HELPER,
  PASTE_PLACEHOLDER,
  type useSetupInvites,
} from '../../hooks/use-setup-invites.ts';

/**
 * Step 3's email card: a section heading with the role and team defaults under it, the chip box,
 * then the role and team pickers. The delivery note gets its own line so it never squeezes them.
 */
export function InviteByEmail({ invites }: { invites: ReturnType<typeof useSetupInvites> }) {
  const headingId = useId();
  return (
    <Card role="region" aria-labelledby={headingId} className="flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="m-0 text-14 font-semibold text-tx">
          Or invite by email
        </h2>
        <p className="m-0 text-12h leading-body text-tx4">{INVITE_HELPER}</p>
      </div>
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
      </div>
      <p className="m-0 text-12 text-tx5">{EMAIL_NOTE}</p>
    </Card>
  );
}
