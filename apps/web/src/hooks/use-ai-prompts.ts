import { queryKeys } from '@bemmoly/api-client';
import type { AiPrompt, AiPromptDiffLine } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { toast, undoToast } from '../lib/toast.ts';

/** Every {{variable}} a template uses that the prompt does not declare. */
export function unknownVariables(prompt: AiPrompt, template: string): string[] {
  const used = [...template.matchAll(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g)].map(
    (match) => match[1] ?? '',
  );
  return [...new Set(used.filter((name) => !prompt.variables.includes(name)))];
}

/**
 * A line diff of two templates (longest common subsequence), so the editor shows what an
 * override changes while it is typed, before anything is saved.
 */
export function diffLines(before: string, after: string): AiPromptDiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      const row = table[i] as number[];
      row[j] =
        a[i] === b[j]
          ? (table[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(table[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const lines: AiPromptDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'same', text: a[i] ?? '' });
      i += 1;
      j += 1;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      lines.push({ kind: 'removed', text: a[i] ?? '' });
      i += 1;
    } else {
      lines.push({ kind: 'added', text: b[j] ?? '' });
      j += 1;
    }
  }
  for (; i < a.length; i += 1) lines.push({ kind: 'removed', text: a[i] ?? '' });
  for (; j < b.length; j += 1) lines.push({ kind: 'added', text: b[j] ?? '' });
  return lines;
}

/** The template the runtime uses now: the override when there is one. */
export const activeTemplate = (prompt: AiPrompt) =>
  prompt.override?.template ?? prompt.defaultTemplate;

/** Prompts: the read-only list, an override saved over the default, and reset with Undo. */
export function useAiPrompts(enabled = true) {
  const client = useQueryClient();
  const list = useQuery({
    queryKey: queryKeys.ai.prompts(),
    queryFn: () => api.ai.prompts.list(),
    enabled,
  });
  const refresh = async (id: string) => {
    await client.invalidateQueries({ queryKey: queryKeys.ai.prompts() });
    await client.invalidateQueries({ queryKey: queryKeys.ai.promptDiff(id) });
  };
  const save = useMutation({
    mutationFn: ({ id, template }: { id: string; template: string }) =>
      api.ai.prompts.override(id, template),
    onSuccess: async (_prompt, { id }) => {
      await refresh(id);
      toast('Prompt override saved');
    },
  });
  const reset = useMutation({
    mutationFn: (prompt: AiPrompt) => api.ai.prompts.reset(prompt.id),
    onSuccess: async (_data, prompt) => {
      await refresh(prompt.id);
      const before = prompt.override?.template;
      if (before) {
        undoToast('Prompt reset to the default', () =>
          save.mutate({ id: prompt.id, template: before }),
        );
      }
    },
    onError: (error) => toast(describeError(error).message, 'danger'),
  });
  return {
    list,
    items: list.data?.items ?? [],
    find: (id: string | null) => list.data?.items.find((prompt) => prompt.id === id) ?? null,
    save,
    reset,
  };
}

export type AiPrompts = ReturnType<typeof useAiPrompts>;
