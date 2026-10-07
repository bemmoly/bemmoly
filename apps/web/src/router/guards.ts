import { hasErrorCode } from '@bemmoly/api-client';
import type { MeResponse } from '@bemmoly/shared';
import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { meQuery, setupStatusQuery } from '../hooks/use-session.ts';
import { isOrgAdmin } from '../lib/session.ts';

/** Only same-origin paths survive a redirect, so a crafted link cannot bounce people away. */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/';
}

async function sessionOrNull(queryClient: QueryClient): Promise<MeResponse | null> {
  try {
    return await queryClient.ensureQueryData(meQuery);
  } catch (error) {
    if (hasErrorCode(error, 'unauthenticated')) return null;
    throw error;
  }
}

/** Whether an org admin still has wizard steps to finish: setup status says when it finished. */
export async function wizardPending(queryClient: QueryClient, me: MeResponse): Promise<boolean> {
  if (!isOrgAdmin(me)) return false;
  const status = await queryClient.ensureQueryData(setupStatusQuery);
  return status.completedAt === null;
}

/** Bootstrap order from the identity stream: setup status, then /me, then everything else. */
export async function requireSession(queryClient: QueryClient, href: string): Promise<MeResponse> {
  const status = await queryClient.ensureQueryData(setupStatusQuery);
  if (!status.initialized) throw redirect({ to: '/setup' });
  const me = await sessionOrNull(queryClient);
  if (!me) throw redirect({ to: '/login', search: { redirect: href } });
  if (await wizardPending(queryClient, me)) throw redirect({ to: '/setup', search: { step: 2 } });
  return me;
}

/** Sign-in pages: a signed-in person goes straight in; a fresh install goes to the wizard. */
export async function requireSignedOut(queryClient: QueryClient, target: string): Promise<void> {
  const status = await queryClient.ensureQueryData(setupStatusQuery);
  if (!status.initialized) throw redirect({ to: '/setup' });
  const me = await sessionOrNull(queryClient);
  if (me) throw redirect({ to: safeRedirect(target) });
}

/** The wizard: step 1 before an admin exists, steps 2 to 6 for that admin until finished. */
export async function requireSetupOpen(queryClient: QueryClient): Promise<MeResponse | null> {
  const status = await queryClient.ensureQueryData(setupStatusQuery);
  if (!status.initialized) return null;
  const me = await sessionOrNull(queryClient);
  if (!me) throw redirect({ to: '/login', search: { redirect: '/setup' } });
  if (!(await wizardPending(queryClient, me))) throw redirect({ to: '/' });
  return me;
}
