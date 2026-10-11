import type { RichTextDoc } from '@bemmoly/editor';
import type { RichText, TemplateDetail, TemplateField } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

export interface TemplateDraft {
  name: string;
  description: string;
  category: string;
  icon: string | null;
  fields: TemplateField[];
  snapshot: RichTextDoc;
}

const EMPTY_DOC: RichTextDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

export const draftOf = (template: TemplateDetail | null): TemplateDraft => ({
  name: template?.name ?? '',
  description: template?.description ?? '',
  category: template?.category ?? '',
  icon: template?.icon ?? null,
  fields: template?.fields ?? [],
  snapshot: (template?.snapshot as RichTextDoc | undefined) ?? EMPTY_DOC,
});

/** What would stop the server taking the draft, said as what to do. */
export function draftProblem(draft: TemplateDraft): { name?: string; fields?: string } {
  return {
    ...(draft.name.trim() ? {} : { name: 'Give the template a name.' }),
    ...(draft.fields.some((field) => !field.label.trim())
      ? { fields: 'Give every field a label, or remove it.' }
      : {}),
    ...(draft.fields.some((field) => field.kind === 'select' && !field.options?.length)
      ? { fields: 'Give every choice field at least one choice.' }
      : {}),
  };
}

const bodyOf = (draft: TemplateDraft) => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
  ...(draft.icon ? { icon: draft.icon } : {}),
  fields: draft.fields.map((field) => ({ ...field, label: field.label.trim() })),
  snapshot: draft.snapshot as RichText,
});

/**
 * The editor's state: the draft, whether it differs from what is stored, and Save, which
 * creates the template when `template` is null and changes it otherwise.
 */
export function useTemplateForm(
  template: TemplateDetail | null,
  onSaved: (saved: TemplateDetail) => void,
  /** A draft Cancel set aside, brought back by its Undo. */
  initial?: TemplateDraft,
) {
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<TemplateDraft>(() => initial ?? draftOf(template));
  const [tried, setTried] = useState(false);
  const [dirty, setDirty] = useState(Boolean(initial));
  const save = useMutation({
    mutationFn: async (next: TemplateDraft) => {
      const body = bodyOf(next);
      if (template) return api.docs.templates.update(template.id, body);
      const { description, ...rest } = body;
      return api.docs.templates.create({
        ...rest,
        ...(description ? { description } : {}),
        spaceId: null,
      });
    },
    onSuccess: (saved) => {
      client.setQueryData(docsKeys.template(saved.id), saved);
      void client.invalidateQueries({ queryKey: [...docsKeys.all(), 'templates'] });
      setDirty(false);
      toast.show({ tone: 'ok', title: template ? 'Template saved' : `${saved.name} added` });
      onSaved(saved);
    },
    onError: (error) =>
      toast.show({
        tone: 'danger',
        title: 'The template was not saved',
        body: `${error.message} Your changes are still here; try again.`,
      }),
  });
  const problem = draftProblem(draft);
  return {
    draft,
    dirty,
    problem: tried ? problem : {},
    saving: save.isPending,
    change(patch: Partial<TemplateDraft>) {
      setDraft((current) => ({ ...current, ...patch }));
      setDirty(true);
    },
    reset(next: TemplateDraft) {
      setDraft(next);
      setDirty(false);
      setTried(false);
    },
    submit() {
      setTried(true);
      if (save.isPending || Object.keys(problem).length > 0) return;
      save.mutate(draft);
    },
  };
}

export type TemplateForm = ReturnType<typeof useTemplateForm>;
