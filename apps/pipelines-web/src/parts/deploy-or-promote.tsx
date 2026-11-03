import { useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BASE_PATH } from '../lib/sign-in.ts';

/** What the person pressed Deploy or promote on; anything left out the dialog asks for. */
export interface DeployTarget {
  service?: string;
  environment?: string;
  version?: string;
}

/**
 * The seam for "Deploy or promote" (stream S3 owns the dialog): `open` starts it for a target
 * and `dialog` is mounted once by the screen. Until the dialog lands, it opens a new change
 * request with the target filled in, which is where every promotion with an approval rule ends.
 */
export function useDeployOrPromote(): { open: (target: DeployTarget) => void; dialog: ReactNode } {
  const router = useRouter();
  const open = (target: DeployTarget) => {
    const query = new URLSearchParams(
      Object.entries(target).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    router.history.push(`${BASE_PATH}/changes/new${query ? `?${query}` : ''}`);
  };
  return { open, dialog: null };
}
