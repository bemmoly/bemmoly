import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyIssues } from '../../../shared/index.ts';
import { workKeys } from '../shared/keys.ts';
import { api } from '../shared/api.ts';

export type MyWorkTab = keyof MyIssues;

export const MY_WORK_TABS: ReadonlyArray<{ value: MyWorkTab; label: string }> = [
  { value: 'assigned', label: 'Assigned to me' },
  { value: 'reported', label: 'Reported by me' },
  { value: 'watching', label: 'Watching' },
];

/** The three lists in one request, and which tab is open. */
export function useMyWork() {
  const [tab, setTab] = useState<MyWorkTab>('assigned');
  const query = useQuery({
    queryKey: workKeys.myIssues(),
    queryFn: () => api.work.myWork.myIssues(),
  });
  return {
    tab,
    setTab,
    lists: query.data,
    list: query.data?.[tab],
    isPending: query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
  };
}
