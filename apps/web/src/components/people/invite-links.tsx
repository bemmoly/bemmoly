import { Button, Input, Modal } from '@bemmoly/ui';
import { Link } from '@tanstack/react-router';
import { EMAIL_MISSING, EMAIL_SENT, LINK_NOTE, useCopyLink } from '../../hooks/use-copy-link.ts';
import { Notice } from '../form.tsx';

export interface InviteLink {
  email: string;
  acceptUrl: string;
}

interface InviteLinksProps {
  links: readonly InviteLink[];
  /** Whether the server can email; unknown (no notice) for a link copied later. */
  emailConfigured?: boolean;
}

/**
 * Who was just invited and each accept link, to share by hand. It is the way in while email
 * is not set up; the Users page and the setup wizard's People step both render it.
 */
export function InviteLinks({ links, emailConfigured }: InviteLinksProps) {
  const { copied, copy } = useCopyLink();
  return (
    <div className="flex flex-col gap-3.5">
      {emailConfigured === undefined ? null : emailConfigured ? (
        <Notice>{EMAIL_SENT}</Notice>
      ) : (
        <Notice tone="caution">
          {EMAIL_MISSING}{' '}
          <Link to="/settings/email" className="font-medium">
            Set up email
          </Link>
        </Notice>
      )}
      <ul aria-label="Invite links" className="m-0 flex list-none flex-col gap-2.5 p-0">
        {links.map((link) => (
          <li key={link.acceptUrl} className="flex flex-col gap-1">
            <span className="text-13 font-medium">{link.email}</span>
            <div className="flex items-center gap-2">
              <Input
                mono
                readOnly
                wrapperClassName="min-w-0 flex-1"
                aria-label={`Invite link for ${link.email}`}
                value={link.acceptUrl}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                aria-label={`Copy link for ${link.email}`}
                onClick={() => void copy(link.acceptUrl)}
              >
                {copied === link.acceptUrl ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="m-0 text-12 leading-body text-tx5">{LINK_NOTE}</p>
    </div>
  );
}

interface InviteLinkModalProps {
  link: InviteLink | null;
  onClose: () => void;
}

/** "Copy invite link" on a Users row: a fresh link for one pending invitation. */
export function InviteLinkModal({ link, onClose }: InviteLinkModalProps) {
  if (!link) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title="Invite link"
      description="A new link for this invitation. The previous link no longer works."
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <InviteLinks links={[link]} />
    </Modal>
  );
}
