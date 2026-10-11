import { isApiError, queryKeys } from '@bemmoly/api-client';
import type {
  OAuthAccess,
  OAuthAuthorizationPreview,
  OAuthAuthorizeRequest,
} from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { api, markSession } from '../lib/api.ts';

/** The decision leaves the page for the client's redirect; tests swap this out. */
export const navigation = { assign: (url: string) => window.location.assign(url) };

const FIELDS = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'state',
  'resource',
] as const;

/**
 * The authorization request in the address, exactly as the client wrote it: read from the raw
 * query, since the router would turn a numeric `state` into a number.
 */
export function authorizeRequestOf(searchStr: string): OAuthAuthorizeRequest {
  const params = new URLSearchParams(searchStr);
  const picked: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value) picked[field] = value;
  }
  return {
    ...picked,
    response_type: picked['response_type'] ?? '',
    client_id: picked['client_id'] ?? '',
    redirect_uri: picked['redirect_uri'] ?? '',
  };
}

/** Why the screen cannot go on, in the words the page shows. */
export type ConsentBlock = 'mcp_off' | 'untrusted';

export function blockOf(error: unknown): ConsentBlock | null {
  if (!isApiError(error)) return null;
  const reason = (error.details as { reason?: string } | undefined)?.reason;
  if (reason === 'mcp_disabled') return 'mcp_off';
  if (error.code === 'validation_failed' || error.status === 400) return 'untrusted';
  return null;
}

type Ready = Extract<OAuthAuthorizationPreview, { status: 'ready' }>;

/** What the person picks: the access and the modules, never more than offered. */
export function useConsentChoice(preview: Ready) {
  const [access, setAccess] = useState<OAuthAccess>(preview.access);
  const [modules, setModules] = useState<string[]>(() =>
    preview.moduleOptions.map((option) => option.id),
  );
  const toggle = (id: string) =>
    setModules((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  const everything =
    preview.requestedModules === null && modules.length === preview.moduleOptions.length;
  return {
    access,
    setAccess,
    modules,
    toggle,
    /** Every module, including ones turned on later, when nothing was narrowed. */
    chosenModules: everything ? null : modules,
    error: modules.length === 0 ? 'Choose at least one module.' : null,
  };
}

/** The consent screen: the preview of the request, and the decision that leaves the page. */
export function useOAuthConsent(request: OAuthAuthorizeRequest) {
  const key = new URLSearchParams(request as unknown as Record<string, string>).toString();
  const preview = useQuery({
    queryKey: queryKeys.oauth.preview(key),
    queryFn: () => api.oauth.preview(request),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const decide = useMutation({
    mutationFn: (choice: { approve: boolean; access?: OAuthAccess; modules?: string[] | null }) =>
      api.oauth.decide({ request, ...choice }),
    onSuccess: ({ redirectUrl }) => navigation.assign(redirectUrl),
  });
  return { preview, decide, block: blockOf(preview.error) };
}

/** "Not you?": signs out and comes back to this same request after the next sign-in. */
export function useSwitchPerson() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const href = useLocation({ select: (location) => location.href });
  return useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: async () => {
      markSession(false);
      queryClient.clear();
      await navigate({ to: '/login', search: { redirect: href } });
    },
  });
}
