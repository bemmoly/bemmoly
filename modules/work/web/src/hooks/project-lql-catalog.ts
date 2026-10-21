import type { LqlFieldCatalog } from '@bemmoly/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workSettingsKeys } from '../api/index.ts';
import { settingsCatalog } from '../settings/model/lql.ts';
import { api } from '../shared/index.ts';

/**
 * The fields a project's queries may name: the issue fields plus its custom fields as
 * `cf.<key>`, so the Board's and the Backlog's query bars check and complete them the way the
 * server will run them. Shares its cache with Settings; until it loads, the issue fields alone.
 */
export function useProjectLqlCatalog(projectId: string | undefined): LqlFieldCatalog {
  const fields = useQuery({
    queryKey: workSettingsKeys.fields(projectId ?? null),
    queryFn: () => api.work.fields.list(projectId ?? null),
    enabled: Boolean(projectId),
    retry: false,
  });
  return useMemo(() => settingsCatalog(fields.data), [fields.data]);
}
