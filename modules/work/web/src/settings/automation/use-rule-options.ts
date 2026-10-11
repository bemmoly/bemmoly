import { webhookEndpoints, webhookKeys } from '@bemmoly/api-client/webhooks';
import type { SelectOption } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { usePeople } from '../../hooks/issue-people.ts';
import { useFields, useIssueTypes, useLabels, useStatuses } from '../../hooks/projects-catalog.ts';
import { api } from '../../shared/index.ts';
import { checkLql, settingsCatalog } from '../model/lql.ts';

const webhooksApi = webhookEndpoints(api.http);

const names = (values: Iterable<string>): SelectOption[] =>
  [...new Set(values)].map((name) => ({ value: name, label: name }));

/** Keeps a stored value pickable when this project no longer has it (a global rule's label). */
export function withCurrent(options: readonly SelectOption[], current: unknown): SelectOption[] {
  if (typeof current !== 'string' || !current || options.some((o) => o.value === current)) {
    return [...options];
  }
  return [...options, { value: current, label: current, description: 'Not in this project' }];
}

/**
 * What the rule builder's pickers offer, from this project: its workflow's status names, its
 * labels by name, the workspace's people and webhooks, and the LQL catalog for conditions.
 */
export function useRuleOptions(projectKey: string | undefined, projectId: string | null) {
  const statusMap = useStatuses(projectId ?? undefined);
  const labels = useLabels(projectKey);
  const fields = useFields(projectKey);
  const types = useIssueTypes(projectKey);
  const people = usePeople();
  const targets = useQuery({
    queryKey: webhookKeys.targets(),
    queryFn: () => webhooksApi.targets(),
    staleTime: 60_000,
  });
  const statuses = useMemo(
    () =>
      names(
        [...statusMap.values()]
          .sort((a, b) => a.position - b.position)
          .map((status) => status.name),
      ),
    [statusMap],
  );
  const catalog = useMemo(() => settingsCatalog(fields.data), [fields.data]);
  const values = useMemo(
    () => ({
      statuses: statuses.map((option) => option.value),
      issueTypes: types.types.map((type) => type.name),
    }),
    [statuses, types.types],
  );
  return {
    statuses,
    labels: names((labels.data ?? []).map((label) => label.name)),
    webhooks: (targets.data?.items ?? []).map((target): SelectOption => ({
      value: target.id,
      label: target.name,
      ...(target.enabled ? {} : { description: 'Paused: deliveries are not sent' }),
    })),
    webhooksPending: targets.isPending,
    people,
    catalog,
    values,
    checkQuery: (query: string) => checkLql(query, catalog)?.message ?? null,
  };
}

export type RuleOptions = ReturnType<typeof useRuleOptions>;
