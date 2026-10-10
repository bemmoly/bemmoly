import type {
  CreateFieldBody,
  CreateIssueTypeBody,
  Field,
  IssueType,
  SchemeKind,
  UpdateFieldBody,
  UpdateIssueTypeBody,
} from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workSettingsKeys } from '../api/index.ts';
import { api, workKeys } from '../shared/index.ts';

/**
 * A project's schemes: which org defaults it inherits and which it has
 * copied to change. Override copies the org default into the project; reset
 * drops the copy. Both are reviewed against the diff before they are sent.
 */
export function useSchemes(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const id = projectId ?? '';
  const list = useQuery({
    queryKey: workSettingsKeys.schemes(id),
    queryFn: () => api.work.schemes.list(id),
    enabled: Boolean(projectId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: workKeys.all() });
  const override = useMutation({
    mutationFn: (kind: SchemeKind) => api.work.schemes.override(id, kind),
    onSettled: refresh,
  });
  const reset = useMutation({
    mutationFn: (kind: SchemeKind) => api.work.schemes.reset(id, kind),
    onSettled: refresh,
  });
  const status = (kind: SchemeKind) => list.data?.items.find((item) => item.kind === kind);
  return { list, status, override, reset };
}

/** The rows a scheme's project copy changes from its org default; read when the diff opens. */
export function useSchemeDiff(projectId: string | undefined, kind: SchemeKind, open: boolean) {
  const id = projectId ?? '';
  return useQuery({
    queryKey: workSettingsKeys.schemeDiff(id, kind),
    queryFn: () => api.work.schemes.diff(id, kind),
    enabled: Boolean(projectId) && open,
  });
}

/** A project's issue types: the org default ones until the scheme is overridden. */
export function useIssueTypes(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const id = projectId ?? '';
  const list = useQuery({
    queryKey: workSettingsKeys.issueTypes(id),
    queryFn: () => api.work.issueTypes.list(id),
    enabled: Boolean(projectId),
    select: (items) => [...items].sort((a, b) => a.position - b.position),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: workKeys.all() });
  const create = useMutation({
    mutationFn: (body: CreateIssueTypeBody) => api.work.issueTypes.create(id, body),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ typeId, body }: { typeId: string; body: UpdateIssueTypeBody }) =>
      api.work.issueTypes.update(typeId, body),
    onMutate: async ({ typeId, body }) => {
      await queryClient.cancelQueries({ queryKey: workSettingsKeys.issueTypes(id) });
      queryClient.setQueryData<IssueType[]>(workSettingsKeys.issueTypes(id), (items) =>
        items?.map((item) => (item.id === typeId ? { ...item, ...body } : item)),
      );
    },
    onSettled: refresh,
  });
  /** Optimistic: the rows move at once and settle on the server's order. */
  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.work.issueTypes.reorder(id, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: workSettingsKeys.issueTypes(id) });
      queryClient.setQueryData<IssueType[]>(workSettingsKeys.issueTypes(id), (items) =>
        items?.map((item) => ({ ...item, position: ids.indexOf(item.id) })),
      );
    },
    onSettled: refresh,
  });
  return { list, create, update, reorder };
}

/** A project's custom fields: the org default ones until the scheme is overridden. */
export function useFields(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const id = projectId ?? '';
  const list = useQuery({
    queryKey: workSettingsKeys.fields(id),
    queryFn: () => api.work.fields.list(id),
    enabled: Boolean(projectId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: workKeys.all() });
  const create = useMutation({
    mutationFn: (body: CreateFieldBody) => api.work.fields.create(id, body),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ fieldId, body }: { fieldId: string; body: UpdateFieldBody }) =>
      api.work.fields.update(fieldId, body),
    onMutate: async ({ fieldId, body }) => {
      await queryClient.cancelQueries({ queryKey: workSettingsKeys.fields(id) });
      queryClient.setQueryData<Field[]>(workSettingsKeys.fields(id), (items) =>
        items?.map((item) => (item.id === fieldId ? { ...item, ...body } : item)),
      );
    },
    onSettled: refresh,
  });
  return { list, create, update };
}
