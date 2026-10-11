import { fieldErrors } from '@bemmoly/api-client';
import type { AutomationRule } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { automationKeys } from '../../api/index.ts';
import { api } from '../../shared/index.ts';
import {
  draftOf,
  draftProblems,
  emptyDraft,
  move,
  newStep,
  stepKey,
  toBody,
  type Problems,
  type RuleDraft,
  type Step,
} from './model.ts';

/**
 * The rule builder's state: the draft as a sentence (when, if, then), its problems once the
 * person has tried to save, and the save itself, which makes the rule run as whoever saved it.
 */
export function useRuleBuilder(options: {
  rule: AutomationRule | null;
  projectId: string | null;
  checkQuery: (query: string) => string | null;
  onSaved: () => void;
}) {
  const { rule, projectId, checkQuery, onSaved } = options;
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<RuleDraft>(() => (rule ? draftOf(rule) : emptyDraft()));
  const [tried, setTried] = useState(false);
  const save = useMutation({
    mutationFn: (next: RuleDraft) => {
      const body = toBody(next, rule ? rule.projectId : projectId);
      if (!rule) return api.work.automation.create(body);
      // A rule never moves between a project and global; the update leaves projectId out.
      const patch: Partial<typeof body> = { ...body };
      delete patch.projectId;
      return api.work.automation.update(rule.id, patch);
    },
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: automationKeys.all() });
      toast.show({ tone: 'ok', title: `${saved.name} saved`, body: 'It runs as you from now on.' });
      onSaved();
    },
  });
  const problems: Problems = tried
    ? { ...draftProblems(draft, checkQuery), ...fieldErrors(save.error) }
    : {};

  const set = (patch: Partial<RuleDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const setAction = (key: string, patch: Partial<Step>) =>
    set({
      actions: draft.actions.map((step) => (step.key === key ? { ...step, ...patch } : step)),
    });

  return {
    draft,
    problems,
    save,
    set,
    setTrigger: (name: string) => set({ trigger: newStep(name) }),
    setTriggerArgs: (args: Record<string, unknown>) =>
      set({ trigger: { ...draft.trigger, args: { ...draft.trigger.args, ...args } } }),
    addCondition: () => set({ conditions: [...draft.conditions, { key: stepKey(), query: '' }] }),
    setCondition: (key: string, query: string) =>
      set({
        conditions: draft.conditions.map((row) => (row.key === key ? { ...row, query } : row)),
      }),
    removeCondition: (key: string) =>
      set({ conditions: draft.conditions.filter((row) => row.key !== key) }),
    addAction: (name: string) => set({ actions: [...draft.actions, newStep(name)] }),
    changeAction: (key: string, name: string) => setAction(key, { name, args: newStep(name).args }),
    setActionArgs: (key: string, args: Record<string, unknown>) => {
      const step = draft.actions.find((row) => row.key === key);
      if (step) setAction(key, { args: { ...step.args, ...args } });
    },
    moveAction: (index: number, step: -1 | 1) => set({ actions: move(draft.actions, index, step) }),
    removeAction: (key: string) => set({ actions: draft.actions.filter((row) => row.key !== key) }),
    submit: () => {
      setTried(true);
      if (Object.keys(draftProblems(draft, checkQuery)).length === 0) save.mutate(draft);
    },
  };
}

export type RuleBuilder = ReturnType<typeof useRuleBuilder>;
