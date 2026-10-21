import { queryKeys } from '@bemmoly/api-client';
import type { AutomationRule, CreateAutomationRuleBody } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { automationKeys } from '../../api/index.ts';
import { useProjectActions } from '../../hooks/project-actions.ts';
import { api, useProject } from '../../shared/index.ts';

/** Org admins alone hold "Delete workspace"; it stands for them where no capability does. */
const ORG_ADMIN_SIGNAL = 'workspace.delete';

/** Who may change which rules: project rules with "Edit automation" there, global ones as an org admin. */
export function useAutomationAccess(projectKey: string | undefined) {
  const allowed = useProjectActions(projectKey);
  const me = useQuery({
    queryKey: queryKeys.me(),
    queryFn: () => api.auth.me(),
    staleTime: 60_000,
  });
  const orgAdmin = (me.data?.capabilities ?? []).includes(ORG_ADMIN_SIGNAL);
  const editRules = orgAdmin || allowed.can('work.automation.edit');
  return {
    editRules,
    orgAdmin,
    canChange: (rule: Pick<AutomationRule, 'projectId'>) =>
      rule.projectId === null ? orgAdmin : editRules,
  };
}

/**
 * Project settings › Automation: the project's rules and the global ones, the registry's
 * catalog, and the changes made from the list (on or off at once, delete with Undo).
 */
export function useAutomation(projectKey: string | undefined) {
  const client = useQueryClient();
  const toast = useToast();
  const { project, isPending: projectPending } = useProject(projectKey);
  const projectId = project?.id ?? null;
  const key = automationKeys.rules(projectId);
  const rules = useQuery({
    queryKey: key,
    queryFn: () => api.work.automation.rules(projectId),
    enabled: Boolean(projectId),
  });
  const catalog = useQuery({
    queryKey: automationKeys.catalog(),
    queryFn: () => api.work.automation.catalog(),
    staleTime: 5 * 60_000,
  });
  const all = rules.data ?? [];
  const refresh = () => client.invalidateQueries({ queryKey: automationKeys.all() });

  const setEnabled = useMutation({
    mutationFn: ({ rule, enabled }: { rule: AutomationRule; enabled: boolean }) =>
      api.work.automation.update(rule.id, { enabled }),
    onMutate: async ({ rule, enabled }) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<AutomationRule[]>(key);
      client.setQueryData<AutomationRule[]>(key, (rows) =>
        rows?.map((row) => (row.id === rule.id ? { ...row, enabled } : row)),
      );
      return { before };
    },
    onError: (error, { rule, enabled }, context) => {
      client.setQueryData(key, context?.before);
      toast.show({
        tone: 'danger',
        title: `${rule.name} is still ${enabled ? 'off' : 'on'}`,
        body: error.message,
      });
    },
    onSettled: refresh,
  });

  const recreate = useMutation({
    mutationFn: (body: CreateAutomationRuleBody) => api.work.automation.create(body),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (rule: AutomationRule) => api.work.automation.remove(rule.id),
    onMutate: (rule) => {
      const before = client.getQueryData<AutomationRule[]>(key);
      client.setQueryData<AutomationRule[]>(key, (rows) =>
        rows?.filter((row) => row.id !== rule.id),
      );
      return { before };
    },
    onError: (error, rule, context) => {
      client.setQueryData(key, context?.before);
      toast.show({ tone: 'danger', title: `${rule.name} was not deleted`, body: error.message });
    },
    onSuccess: (_, rule) =>
      toast.undo({
        title: `${rule.name} deleted`,
        body: 'Undo saves it again, running as you.',
        onUndo: () =>
          recreate.mutate({
            name: rule.name,
            projectId: rule.projectId,
            enabled: rule.enabled,
            trigger: rule.trigger,
            conditions: rule.conditions,
            actions: rule.actions,
          }),
      }),
    onSettled: refresh,
  });

  const test = useMutation({
    mutationFn: ({ rule, issueKey }: { rule: AutomationRule; issueKey: string }) =>
      api.work.automation.test(rule.id, issueKey),
    onSuccess: refresh,
  });

  return {
    project,
    projectId,
    projectMissing: !projectPending && !project,
    rules,
    projectRules: all.filter((rule) => rule.projectId !== null),
    globalRules: all.filter((rule) => rule.projectId === null),
    byId: (id: string | null) => all.find((rule) => rule.id === id),
    catalog,
    setEnabled,
    remove,
    test,
    isPending: projectPending || rules.isPending,
    error: rules.error ?? null,
  };
}
