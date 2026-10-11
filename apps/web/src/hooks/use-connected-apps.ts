import { queryKeys } from '@bemmoly/api-client';
import type { OAuthGrant } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api.ts';
import { toast } from '../lib/toast.ts';

/** "Read only" or "Read and write", as the tokens table says it. */
export const grantAccessLabel = (grant: OAuthGrant) =>
  grant.access === 'write' ? 'Read and write' : 'Read only';

/** Profile › Access tokens › Connected apps: apps signed in over MCP, and disconnecting one. */
export function useConnectedApps() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.oauth.grants(), queryFn: () => api.oauth.grants() });
  const [revoking, setRevoking] = useState<OAuthGrant | null>(null);
  const revoke = useMutation({
    mutationFn: (grant: OAuthGrant) => api.oauth.revokeGrant(grant.id),
    onSuccess: async (_, grant) => {
      setRevoking(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.oauth.grants() });
      toast(`${grant.client.name} disconnected`);
    },
  });
  const ask = (grant: OAuthGrant | null) => {
    revoke.reset();
    setRevoking(grant);
  };
  return { query, grants: query.data?.items ?? [], revoking, ask, revoke };
}
