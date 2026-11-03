import { useRouter } from '@tanstack/react-router';
import { useState, type ReactNode } from 'react';
import { BASE_PATH } from '../lib/sign-in.ts';
import { DeployOrPromoteDialog } from '../screens/change-requests/deploy-dialog.tsx';

/** What the person pressed Deploy or promote on; anything left out the dialog asks for. */
export interface DeployTarget {
  service?: string;
  environment?: string;
  /** A release id or a version's name. */
  version?: string;
}

/**
 * "Deploy or promote" for any screen: `open` starts the dialog on a target and `dialog` is
 * mounted once by the screen. The dialog works on one service, so opening it with none starts
 * a new change request, where the person picks the service first.
 */
export function useDeployOrPromote(): { open: (target: DeployTarget) => void; dialog: ReactNode } {
  const router = useRouter();
  const [target, setTarget] = useState<DeployTarget | null>(null);
  const open = (next: DeployTarget) => {
    if (next.service) {
      setTarget(next);
      return;
    }
    const query = new URLSearchParams(
      Object.entries(next).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    router.history.push(`${BASE_PATH}/changes/new${query ? `?${query}` : ''}`);
  };
  return {
    open,
    dialog: target?.service ? (
      <DeployOrPromoteDialog
        open
        onClose={() => setTarget(null)}
        application={target.service}
        {...(target.environment ? { environment: target.environment } : {})}
        {...(target.version ? { release: target.version } : {})}
      />
    ) : null,
  };
}
