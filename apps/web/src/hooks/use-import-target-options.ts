import { queryKeys } from '@bemmoly/api-client';
import type { SelectOption } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { importsApi } from '../lib/imports-api.ts';

/*
 * The projects or spaces an import can go into, for Options' Existing picker, from the import
 * job itself: the kernel asks the importing module, so Settings never reads a module's routes.
 */

/** "Support desk (SUP)". */
export const holderLabel = (holder: { name: string; key: string }) =>
  `${holder.name} (${holder.key})`;

export function useImportTargetOptions(jobId: string, enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.imports.targets(jobId),
    queryFn: () => importsApi.targets(jobId, { limit: 200 }),
    enabled,
    staleTime: 60_000,
  });
  const options: SelectOption[] = (query.data?.items ?? []).map((holder) => ({
    value: holder.id,
    label: holderLabel(holder),
  }));
  return { options, loading: query.isPending && enabled, error: query.error };
}
