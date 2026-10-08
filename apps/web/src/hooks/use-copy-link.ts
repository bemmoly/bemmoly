import { useState } from 'react';
import { toast } from '../lib/toast.ts';

export const EMAIL_MISSING = "Email isn't set up yet, so share these links yourself.";
export const EMAIL_SENT =
  'Invitations are on their way by email. You can also share these links yourself.';
export const LINK_NOTE =
  'Each link signs up one person and expires in 7 days. Copying a new link from Users replaces the old one.';

/**
 * Copies an invite link. The clipboard API exists only on secure origins, and a self-hosted
 * install is often plain http on a LAN, so the link is also on screen to select by hand.
 */
export function useCopyLink() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (url: string) => {
    try {
      if (!navigator.clipboard) throw new Error('The clipboard is not available here');
      await navigator.clipboard.writeText(url);
      setCopied(url);
      toast('Invite link copied');
    } catch {
      toast('Copying is blocked on this connection. Select the link and copy it.', 'danger');
    }
  };
  return { copied, copy };
}
