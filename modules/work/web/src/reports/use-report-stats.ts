import { STAT_FIELDS, type StatField } from '@bemmoly/module-work/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, workKeys } from '../shared/index.ts';
import { useSearchParam } from '../shared/url-state.ts';

/*
 * Field statistics, with the two fields in the address (?stat=&stat2=) so a
 * table someone found worth sharing opens the same for whoever follows the link.
 */

export const STAT_FIELD_LABELS: Record<StatField, string> = {
  status: 'Status',
  assignee: 'Assignee',
  type: 'Type',
  priority: 'Priority',
  label: 'Label',
  epic: 'Epic',
  version: 'Version',
  component: 'Component',
};

const isField = (value: string | null): value is StatField =>
  (STAT_FIELDS as readonly string[]).includes(value ?? '');

export function useReportStats(projectKey: string) {
  const byParam = useSearchParam('stat');
  const by2Param = useSearchParam('stat2');
  const by: StatField = isField(byParam) ? byParam : 'status';
  const by2: StatField | null = isField(by2Param) && by2Param !== by ? by2Param : null;
  const stats = useQuery({
    queryKey: workKeys.reportStats(projectKey, by, by2),
    queryFn: ({ signal }) =>
      api.work.reportStats.get(projectKey, { by, ...(by2 ? { by2 } : {}) }, { signal }),
    enabled: Boolean(projectKey),
    placeholderData: keepPreviousData,
  });
  return { by, by2, stats };
}
