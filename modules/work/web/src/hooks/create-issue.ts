import type { CreateIssueBody, Issue, IssuePriority, RichText } from '@bemmoly/module-work/shared';
import { ApiError } from '@bemmoly/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { textToDoc } from '../issue/rich-text-convert.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { useLayoutFields, type LayoutField } from './issue-fields.ts';
import { useIssueTypes } from './projects-catalog.ts';

/** The built-in fields every form shows, in this order, whatever the layout lists. */
export const DEFAULT_FIELDS = [
  'assigneeId',
  'priority',
  'labelIds',
  'estimate',
  'sprintId',
  'fixVersionId',
] as const;

export interface CreateDraft {
  title: string;
  /** The description as the editor holds it; null while nothing is written. */
  description: RichText | null;
  /** Where the issue lands; null starts it in the workflow's first status. */
  statusId: string | null;
  priority: IssuePriority;
  assigneeId: string | null;
  labelIds: string[];
  estimate: string;
  sprintId: string | null;
  fixVersionId: string | null;
  parentId: string | null;
  dueAt: string;
  /** Custom values by field key; rich text is held as text until submit. */
  custom: Record<string, unknown>;
}

const EMPTY: CreateDraft = {
  title: '',
  description: null,
  statusId: null,
  priority: 'medium',
  assigneeId: null,
  labelIds: [],
  estimate: '',
  sprintId: null,
  fixVersionId: null,
  parentId: null,
  dueAt: '',
  custom: {},
};

export interface CreateIssueOptions {
  projectKey: string | undefined;
  /** Creating a subtask: the parent's id and the subtask type comes first. */
  parentId?: string;
  /** Defaults from where the person started; a description may come as plain text. */
  initial?: CreateInitial;
}

export type CreateInitial = Partial<Omit<CreateDraft, 'description'>> & {
  description?: RichText | string | null;
};

/** What a new draft starts from: the opener's defaults over the empty form. */
function startDraft(initial: CreateInitial | undefined, parentId: string | undefined) {
  const { description, ...rest } = initial ?? {};
  return {
    ...EMPTY,
    ...rest,
    description: typeof description === 'string' ? textToDoc(description) : (description ?? null),
    parentId: parentId ?? rest.parentId ?? null,
  };
}

/** Rich text with no words in it counts as blank, as an empty editor does. */
const emptyDoc = (value: unknown) =>
  typeof value === 'object' &&
  value !== null &&
  (value as { type?: string }).type === 'doc' &&
  !JSON.stringify(value).includes('"text":');

const blank = (value: unknown) =>
  emptyDoc(value) ||
  value === null ||
  value === undefined ||
  (typeof value === 'string' && !value.trim()) ||
  (Array.isArray(value) && value.length === 0);

const without = (errors: Record<string, string>, key: string) =>
  Object.fromEntries(Object.entries(errors).filter(([name]) => name !== key));

/** The value a layout row names, read from the draft. */
export function draftValue(draft: CreateDraft, row: LayoutField): unknown {
  if (row.column === 'title') return draft.title;
  if (row.column === 'description') return draft.description;
  if (row.column) return draft[row.column as keyof CreateDraft];
  return draft.custom[row.field.key];
}

/**
 * The create form: the project and type, the draft, the type's layout, validation against
 * the layout's required flags, and the create call. The server numbers the issue under the
 * project's counter lock, so the key in the toast is the next one without gaps.
 */
export function useCreateIssue({ projectKey: startKey, parentId, initial }: CreateIssueOptions) {
  const [projectKey, setProjectKey] = useState(startKey);
  const [typeId, setTypeId] = useState<string | undefined>(undefined);
  const [draft, setDraft] = useState<CreateDraft>(() => startDraft(initial, parentId));
  /** Bumped on each fresh draft, so the editors start again from empty. */
  const [round, setRound] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const types = useIssueTypes(projectKey);
  const layout = useLayoutFields(projectKey, typeId);
  const queryClient = useQueryClient();

  useEffect(() => setProjectKey(startKey), [startKey]);

  const choices = useMemo(
    () =>
      types.types.filter((type) =>
        parentId ? type.level === 'subtask' : type.level !== 'subtask',
      ),
    [types.types, parentId],
  );
  useEffect(() => {
    if (choices.some((type) => type.id === typeId)) return;
    setTypeId((choices.find((type) => type.level === 'standard') ?? choices[0])?.id);
  }, [choices, typeId]);

  const set = <K extends keyof CreateDraft>(key: K, value: CreateDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => without(current, key));
  };
  const setCustom = (key: string, value: unknown) => {
    setDraft((current) => ({ ...current, custom: { ...current.custom, [key]: value } }));
    setErrors((current) => without(current, `customFields.${key}`));
  };

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!draft.title.trim()) found['title'] = 'Give the issue a title.';
    if (draft.estimate && !(Number(draft.estimate) >= 0)) found['estimate'] = 'Use a number.';
    for (const row of layout.rows) {
      if (!row.required || row.column === 'title') continue;
      if (!blank(draftValue(draft, row))) continue;
      found[row.column ?? `customFields.${row.field.key}`] = `${row.field.name} is required.`;
    }
    return found;
  };

  /**
   * The server files every issue in its workflow's first status; a column's "New issue"
   * asks for another, so the create is followed by that one transition. If the workflow
   * refuses it the issue still exists, and the caller says where it landed.
   */
  const create = useMutation({
    mutationFn: async ({ body, statusId }: { body: CreateIssueBody; statusId: string | null }) => {
      const issue = await api.work.issues.create(body);
      if (!statusId || issue.statusId === statusId) return { issue, moved: true };
      try {
        return { issue: await api.work.issues.update(issue.key, { statusId }), moved: true };
      } catch {
        return { issue, moved: false };
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workKeys.all() }),
  });

  const submit = async (projectId: string): Promise<CreateResult | null> => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || !typeId) return null;
    const rich = new Set(layout.fields.filter((f) => f.kind === 'richtext').map((f) => f.key));
    const customFields = Object.fromEntries(
      Object.entries(draft.custom)
        .filter(([, value]) => !blank(value))
        .map(([key, value]) => [
          key,
          rich.has(key) && typeof value === 'string' ? textToDoc(value) : value,
        ]),
    );
    try {
      const body: CreateIssueBody = {
        projectId,
        typeId,
        title: draft.title.trim(),
        description: blank(draft.description) ? null : draft.description,
        priority: draft.priority,
        assigneeId: draft.assigneeId,
        labelIds: draft.labelIds,
        estimate: draft.estimate === '' ? null : Number(draft.estimate),
        sprintId: draft.sprintId,
        fixVersionId: draft.fixVersionId,
        parentId: draft.parentId,
        dueAt: draft.dueAt || null,
        customFields,
      };
      return await create.mutateAsync({ body, statusId: draft.statusId });
    } catch (error) {
      setErrors(serverErrors(error));
      return null;
    }
  };

  /** Anything typed that closing would lose. */
  const dirty =
    Boolean(draft.title.trim()) ||
    !blank(draft.description) ||
    Object.values(draft.custom).some((value) => !blank(value));

  /**
   * Create another: a clean title, description and documents, keeping the project, type and
   * properties, so a run of similar issues is quick to file.
   */
  const again = () => {
    setDraft((current) => ({ ...current, title: '', description: null, custom: {} }));
    setErrors({});
    setRound((value) => value + 1);
  };

  return {
    projectKey,
    setProjectKey: (key: string) => {
      setProjectKey(key);
      setTypeId(undefined);
    },
    typeId,
    setTypeId,
    types: choices,
    layout,
    draft,
    set,
    setCustom,
    errors,
    submit,
    dirty,
    again,
    round,
    isSubmitting: create.isPending,
  };
}

export interface CreateResult {
  issue: Issue;
  /** False when the chosen status was refused and the issue stayed in its first status. */
  moved: boolean;
}

/** The server's field problems by path, or one form-level message. */
function serverErrors(error: unknown): Record<string, string> {
  const issues = (error as ApiError).details as
    { issues?: Array<{ path: string; message: string }> } | undefined;
  if (error instanceof ApiError && issues?.issues?.length) {
    return Object.fromEntries(issues.issues.map((issue) => [issue.path, issue.message]));
  }
  return { form: error instanceof Error ? error.message : 'The issue was not created.' };
}
