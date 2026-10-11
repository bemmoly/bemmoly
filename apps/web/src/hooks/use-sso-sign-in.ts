import { queryKeys, ssoStartPath } from '@bemmoly/api-client';
import { ssoFailureReasonSchema, type SsoFailureReason } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { readLastSignIn, rememberSignIn } from './use-last-sign-in.ts';

/** What the sign-in page says for each closed reason a single sign-on can fail with. */
export const SSO_FAILURE_COPY: Record<SsoFailureReason, string> = {
  expired: 'That sign-in took too long. Start again.',
  state_mismatch: 'That sign-in was started in another tab or browser. Start again from this page.',
  provider_error:
    'Your identity provider refused the sign-in or could not be reached. Try again, or ask your admin.',
  invalid_response:
    'Your identity provider’s answer did not verify, so nobody was signed in. Ask your admin to check the provider’s settings.',
  replayed: 'That sign-in was already used. Start again.',
  email_missing:
    'Your identity provider did not send an email address. Ask your admin to include it.',
  email_unverified:
    'Your identity provider has not verified your email address. Verify it there, then try again.',
  domain_not_allowed:
    'Your email domain is not allowed to sign in here. Use your work account, or ask your admin.',
  not_provisioned: 'You don’t have an account here yet. Ask your admin to invite you.',
  deactivated: 'Your account here has been deactivated. Ask your admin if this is a mistake.',
  disabled: 'That sign-in method has been turned off. Choose another, or ask your admin.',
};

/** The note's title, naming the provider when this device knows which one was tried. */
export function ssoFailureTitle(reason: SsoFailureReason, provider: string | null): string {
  const who = provider ?? 'Your identity provider';
  if (reason === 'expired' || reason === 'state_mismatch' || reason === 'replayed') {
    return 'That sign-in didn’t finish';
  }
  if (reason === 'not_provisioned' || reason === 'deactivated' || reason === 'disabled') {
    return `${who} signed you in, but this workspace didn’t`;
  }
  return `${who} didn’t sign you in`;
}

export function ssoFailureReason(reason: unknown): SsoFailureReason | null {
  const parsed = ssoFailureReasonSchema.safeParse(reason);
  return parsed.success ? parsed.data : null;
}

export function ssoFailureMessage(reason: unknown): string | null {
  const parsed = ssoFailureReasonSchema.safeParse(reason);
  return parsed.success ? SSO_FAILURE_COPY[parsed.data] : null;
}

/** The enabled identity providers for "Continue with …", and whether passwords are off. */
export function useSsoSignIn() {
  const query = useQuery({
    queryKey: queryKeys.sso.signInOptions(),
    queryFn: () => api.sso.signInOptions(),
    staleTime: 60_000,
    retry: false,
  });
  return {
    query,
    // An install whose server predates single sign-on answers 404; that is "no providers".
    options: query.data?.items ?? [],
    requireSso: query.data?.requireSso ?? false,
    /** A full navigation: the server redirects on to the identity provider. */
    start: (providerId: string, returnTo?: string) => {
      const last = readLastSignIn();
      rememberSignIn({
        method: 'sso',
        providerId,
        email: last?.email ?? null,
        name: last?.name ?? null,
      });
      window.location.assign(ssoStartPath(providerId, returnTo));
    },
  };
}
