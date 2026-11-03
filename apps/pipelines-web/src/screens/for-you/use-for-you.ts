import { topicOf, type PersonRole } from '@bemmoly/module-pipelines/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryKeys } from '../../api/delivery.ts';
import { rolesKeys } from '../../api/roles.ts';
import { servicesKeys } from '../../api/services.ts';
import { setupKeys } from '../../api/setup.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

/**
 * Which For you to draw: the setup checklist while setup is not done, the approver's cards,
 * or the developer's and admin's page. Before the role read answers (or where it is not
 * served) the developer's page shows; the server still refuses what a role may not do.
 */
export function useForYouKind(): 'loading' | 'setup' | 'approver' | 'developer' {
  const me = useQuery({ queryKey: rolesKeys.me(), queryFn: () => api.roles.me(), retry: false });
  const checklist = useQuery({
    queryKey: setupKeys.checklist(),
    queryFn: () => api.setup.checklist(),
    retry: false,
  });
  if (me.isPending || checklist.isPending) return 'loading';
  if (checklist.data && !checklist.data.complete) return 'setup';
  const role: PersonRole | undefined = me.data?.role;
  return role === 'approver' ? 'approver' : 'developer';
}

/** The summary and what is running now, read again when anything of the person's moves. */
export function useForYouSummary() {
  const client = useQueryClient();
  useStream([topicOf.forYou()], () => {
    void client.invalidateQueries({ queryKey: servicesKeys.forYou() });
    void client.invalidateQueries({ queryKey: deliveryKeys.runs({ state: ['running'] }) });
  });
  const summary = useQuery({
    queryKey: servicesKeys.forYou(),
    queryFn: () => api.services.forYou(),
  });
  const running = useQuery({
    queryKey: deliveryKeys.runs({ state: ['running'] }),
    queryFn: () => api.delivery.runs({ state: ['running'], limit: 5 }),
    refetchInterval: 15_000,
  });
  return { summary, running };
}
