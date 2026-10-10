import { controlClass, Select, Tag } from '@bemmoly/ui';
import { useId } from 'react';
import {
  EMAIL_NOTE,
  INVITE_HELPER,
  PASTE_PLACEHOLDER,
  type useSetupInvites,
} from '../../hooks/use-setup-invites.ts';

/**
 * The email invites: a heading with the role and team defaults under it, the chip box, then
 * the role and team pickers. Enter in the box turns what was typed into a chip; Enter in an
 * empty box sends the step.
 */
export function InviteByEmail({ invites }: { invites: ReturnType<typeof useSetupInvites> }) {
  const headingId = useId();
  const errorId = useId();
  return (
    <section role="region" aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id={headingId} className="m-0 text-13 font-semibold text-tx">
          Invite by email
        </h2>
        <p className="m-0 text-13 text-tx-3">{INVITE_HELPER}</p>
      </div>
      <div
        className={`flex min-h-24 flex-wrap content-start gap-1.5 bg-card px-3 py-2.5 ${controlClass}`}
      >
        {invites.emails.map((email) => (
          <Tag key={email} size="lg" onRemove={() => invites.remove(email)}>
            {email}
          </Tag>
        ))}
        <input
          autoFocus
          aria-label="Email addresses"
          aria-invalid={invites.error ? true : undefined}
          aria-describedby={invites.error ? errorId : undefined}
          value={invites.text}
          placeholder={invites.emails.length ? PASTE_PLACEHOLDER : 'name@company.com, another@company.com'}
          onChange={(event) => invites.change(event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            invites.paste(event.clipboardData.getData('text'));
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !invites.text.trim()) return;
            event.preventDefault();
            invites.change(`${invites.text}\n`);
          }}
          onBlur={() => invites.text && invites.change(`${invites.text} `)}
          className="h-6.5 min-w-48 flex-1 border-0 bg-transparent p-0 font-sans text-13 text-tx outline-0 placeholder:text-tx-3"
        />
      </div>
      {invites.error ? (
        <span id={errorId} role="alert" className="text-12 text-red-tx">
          {invites.error}
        </span>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-13">
        <span className="text-tx-3">Role</span>
        <Select
          size="sm"
          aria-label="Role"
          options={invites.roleOptions}
          value={invites.roleId ?? ''}
          disabled={invites.loading}
          onChange={(event) => invites.setRoleId(event.target.value)}
        />
        <span className="text-tx-3">Team</span>
        <Select
          size="sm"
          aria-label="Team"
          options={invites.teamOptions}
          value={invites.teamId ?? ''}
          onChange={(event) => invites.setTeamId(event.target.value)}
        />
      </div>
      <p className="m-0 text-12 text-tx-3">{EMAIL_NOTE}</p>
    </section>
  );
}
