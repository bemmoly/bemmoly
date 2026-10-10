import { queryKeys } from '@bemmoly/api-client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MyIssue, MyIssues } from '../../../shared/index.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

export type MyWorkTab = keyof MyIssues | 'mentions';

export const MY_WORK_TABS: ReadonlyArray<{ value: MyWorkTab; label: string }> = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'reported', label: 'Created' },
  { value: 'watching', label: 'Watching' },
  { value: 'mentions', label: 'Mentions' },
];

/** One status's issues, in the order a person works through them: started, to do, done. */
export interface StatusGroup {
  name: string;
  category: MyIssue['status']['category'];
  issues: MyIssue[];
}

const ORDER: Record<MyIssue['status']['category'], number> = { in_progress: 0, todo: 1, done: 2 };

export function groupByStatus(issues: readonly MyIssue[]): StatusGroup[] {
  const groups = new Map<string, StatusGroup>();
  for (const issue of issues) {
    const group = groups.get(issue.status.name) ?? {
      name: issue.status.name,
      category: issue.status.category,
      issues: [],
    };
    group.issues.push(issue);
    groups.set(issue.status.name, group);
  }
  return [...groups.values()].sort((a, b) => ORDER[a.category] - ORDER[b.category]);
}

/** Where someone mentioned the person in an issue, from their inbox. */
export interface Mention {
  id: string;
  key: string | null;
  title: string;
  who: string;
  url: string | null;
  createdAt: string;
}

/**
 * The person's issue lists in one request, the mentions from their inbox, and which tab is
 * open. `limit` is per list: Home asks for six, My issues for the most the server gives.
 */
export function useMyWork(limit = 6) {
  const [tab, setTab] = useState<MyWorkTab>('assigned');
  const query = useQuery({
    queryKey: [...workKeys.myIssues(), limit],
    queryFn: () => api.work.myWork.myIssues(limit),
  });
  const inbox = useQuery({
    queryKey: queryKeys.notifications.list({ limit: 50 }),
    queryFn: () => api.notifications.list({ limit: 50 }),
    enabled: tab === 'mentions',
  });
  const mentions: Mention[] = (inbox.data?.items ?? [])
    .filter((item) => item.kind === 'mention' && item.target.kind.startsWith('work.'))
    .map((item) => ({
      id: item.id,
      key: item.target.label,
      title: item.body || item.summary,
      who: item.actors[0]?.name ?? 'Someone',
      url: item.target.url,
      createdAt: item.createdAt,
    }));
  const list = tab === 'mentions' ? undefined : query.data?.[tab];
  return {
    tab,
    setTab,
    lists: query.data,
    list,
    groups: list ? groupByStatus(list.items) : [],
    mentions,
    isPending: tab === 'mentions' ? inbox.isPending : query.isPending,
    error: tab === 'mentions' ? inbox.error : query.error,
    retry: () => void (tab === 'mentions' ? inbox.refetch() : query.refetch()),
  };
}
