import type { OrgTemplate } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * Settings › Docs' reads and writes. Archive, restore and reorder change the cached list in
 * the same frame and roll back with a toast when the server refuses; every write then
 * refreshes the templates every picker reads.
 */

const LIST = docsKeys.orgTemplates();
const everyTemplateList = [...docsKeys.all(), 'templates'] as const;

export function useOrgTemplates() {
  return useQuery({ queryKey: LIST, queryFn: () => api.docs.orgTemplates.list() });
}

/** One template with its body, for the read view and the editor; archived ones too. */
export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: docsKeys.template(id ?? ''),
    queryFn: () => api.docs.templates.get(id ?? ''),
    enabled: Boolean(id),
  });
}

async function patchList(
  client: QueryClient,
  change: (rows: OrgTemplate[]) => OrgTemplate[],
): Promise<OrgTemplate[] | undefined> {
  await client.cancelQueries({ queryKey: LIST });
  const before = client.getQueryData<OrgTemplate[]>(LIST);
  if (before) client.setQueryData(LIST, change(before));
  return before;
}

const settle = (client: QueryClient) => client.invalidateQueries({ queryKey: everyTemplateList });

const describe = (error: Error) => `${error.message} Try again in a moment.`;

/** Archive (true) or restore (false), each with an Undo that does the other. */
export function useSetArchived() {
  const client = useQueryClient();
  const toast = useToast();
  const mutation = useMutation({
    mutationFn: ({ template, archived }: { template: OrgTemplate; archived: boolean }) =>
      archived ? api.docs.templates.archive(template.id) : api.docs.templates.restore(template.id),
    onMutate: ({ template, archived }) =>
      patchList(client, (rows) =>
        rows.map((row) =>
          row.id === template.id
            ? { ...row, archivedAt: archived ? new Date().toISOString() : null }
            : row,
        ),
      ),
    onError: (error, { archived, template }, before) => {
      if (before) client.setQueryData(LIST, before);
      toast.show({
        tone: 'danger',
        title: `${template.name} was not ${archived ? 'archived' : 'restored'}`,
        body: describe(error),
      });
    },
    onSettled: () => settle(client),
  });
  return {
    isPending: mutation.isPending,
    run(template: OrgTemplate, archived: boolean) {
      mutation.mutate(
        { template, archived },
        {
          onSuccess: () =>
            toast.undo({
              title: `${template.name} ${archived ? 'archived' : 'restored'}`,
              ...(archived ? { body: 'It no longer shows in any template picker.' } : {}),
              onUndo: () => mutation.mutate({ template, archived: !archived }),
            }),
        },
      );
    },
  };
}

/** Moves one active template to another place; the whole active order is saved. */
export function useReorderTemplates() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (ids: readonly string[]) => api.docs.orgTemplates.reorder(ids),
    onMutate: (ids) =>
      patchList(client, (rows) => {
        const place = new Map(ids.map((id, index) => [id, index]));
        return rows
          .map((row) => (place.has(row.id) ? { ...row, position: place.get(row.id) ?? 0 } : row))
          .toSorted(
            (a, b) =>
              Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
              a.position - b.position,
          );
      }),
    onError: (error, _ids, before) => {
      if (before) client.setQueryData(LIST, before);
      toast.show({ tone: 'danger', title: 'The new order was not saved', body: describe(error) });
    },
    onSettled: () => settle(client),
  });
}

/** An editable copy placed after the original; `onCopied` opens it. */
export function useDuplicateTemplate(onCopied: (id: string) => void) {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (template: OrgTemplate) => api.docs.templates.duplicate(template.id),
    onSuccess: (copy) => {
      client.setQueryData(docsKeys.template(copy.id), copy);
      onCopied(copy.id);
    },
    onError: (error, template) =>
      toast.show({
        tone: 'danger',
        title: `${template.name} was not duplicated`,
        body: describe(error),
      }),
    onSettled: () => settle(client),
  });
}
