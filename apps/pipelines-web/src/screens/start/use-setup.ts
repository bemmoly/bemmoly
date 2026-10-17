import { codeHostEndpoints } from '@bemmoly/api-client/code-hosts';
import { useQuery } from '@tanstack/react-query';
import { platformKeys } from '../../api/platform.ts';
import { useConnections } from '../../hooks/use-clouds.ts';
import { useOverview } from '../../hooks/use-overview.ts';
import { api } from '../../lib/api.ts';

const codeHosts = codeHostEndpoints(api.http);

export type SetupStep = 'github' | 'applications' | 'runners' | 'cloud' | 'ship';

export interface SetupState {
  done: Record<SetupStep, boolean>;
  /** null while it is not known, for example when only an admin may read code hosts. */
  github: boolean | null;
  proposals: number;
  loading: boolean;
}

/**
 * How far an install has got, from reads that already exist: a code host connected, the
 * catalog filled, a runner pool, a cloud, and a first deploy to Prod.
 */
export function useSetup(): SetupState {
  const overview = useOverview('');
  const hosts = useQuery({
    queryKey: ['code-hosts'],
    queryFn: () => codeHosts.list(),
    retry: false,
    staleTime: 60_000,
  });
  const proposals = useQuery({
    queryKey: platformKeys.proposals(),
    queryFn: () => api.platform.proposals(),
    retry: false,
  });
  const pools = useQuery({
    queryKey: platformKeys.capacity({ range: 'now' }),
    queryFn: () => api.platform.capacity({ range: 'now' }),
    retry: false,
  });
  const clouds = useConnections();
  const github = hosts.data
    ? hosts.data.some((host) => host.kind === 'github' && host.enabled)
    : null;
  const applications = (overview.data?.catalog.applications ?? 0) > 0;
  return {
    github,
    proposals: proposals.data?.total ?? 0,
    loading: overview.isPending,
    done: {
      github: github ?? applications,
      applications,
      runners: (pools.data?.pools.length ?? 0) > 0,
      cloud: (clouds.data?.items.length ?? 0) > 0,
      ship:
        (overview.data?.today.prodDeploys ?? 0) > 0 || overview.data?.today.leadTimeSeconds != null,
    },
  };
}
