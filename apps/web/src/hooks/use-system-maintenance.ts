import { hasErrorCode, isApiError, queryKeys } from '@bemmoly/api-client';
import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';

/** While a restore, update or rollback runs, reads retry this often. */
export const MAINTENANCE_POLL_MS = 3000;

export const systemHealthQuery = queryOptions({
  queryKey: queryKeys.system(),
  queryFn: () => api.system.health(),
});

export interface Maintenance {
  active: boolean;
  message: string;
  /** Poll interval for the page's own reads: fast while in maintenance, otherwise off. */
  poll: number | false;
}

/**
 * The server's maintenance state. A write refused with 503 maintenance counts
 * only until the state has been read, so the banner clears when it ends.
 */
export function maintenanceOf(
  health: { active: boolean; reason: string | null } | undefined,
  errors: readonly unknown[],
): Maintenance {
  const refused = errors.find((error) => hasErrorCode(error, 'maintenance'));
  const active = health ? health.active : refused !== undefined;
  const message =
    health?.reason ??
    (isApiError(refused) ? refused.message : null) ??
    'Bemmoly is in maintenance.';
  return { active, message, poll: active ? MAINTENANCE_POLL_MS : false };
}

/**
 * Maintenance for the Storage and backups, Updates and System pages. Pass the
 * page's mutation errors so a refused write shows the banner straight away.
 */
export function useSystemMaintenance(errors: readonly unknown[] = []) {
  const queryClient = useQueryClient();
  const health = useQuery({
    ...systemHealthQuery,
    refetchInterval: (query) =>
      query.state.data?.maintenance.active ? MAINTENANCE_POLL_MS : false,
  });
  return {
    ...maintenanceOf(health.data?.maintenance, errors),
    /** Re-reads the state after a write that may have started maintenance. */
    refresh: () => queryClient.invalidateQueries({ queryKey: queryKeys.system() }),
  };
}
