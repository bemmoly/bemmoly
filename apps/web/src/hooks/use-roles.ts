import { queryKeys } from '@bemmoly/api-client';
import { createRoleSchema } from '@bemmoly/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { api } from '../lib/api.ts';
import { describeError, serverFieldErrors, validateForm, type FieldErrors } from '../lib/errors.ts';
import { toast } from '../lib/toast.ts';
import { capabilitiesQuery, useCanManagePeople } from './use-people.ts';
import {
  cellOf,
  cellsOf,
  groupRows,
  isFixedRole,
  isRowLocked,
  rolePayloads,
  toggleCell,
  toggleRowLock,
  type CellMap,
  type RolePayload,
} from './use-roles-matrix.ts';

const NO_CELLS: CellMap = {};

async function refreshAccess(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.capabilities() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.roles() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me() }),
  ]);
}

/**
 * The roles matrix with a local draft: cells change on the page and Save sends one PUT per
 * changed role. Org admin is shown but never edited or sent.
 */
export function useRolesMatrix() {
  const queryClient = useQueryClient();
  const canManage = useCanManagePeople();
  const query = useQuery(capabilitiesQuery);
  const base = useMemo(() => (query.data ? cellsOf(query.data) : NO_CELLS), [query.data]);
  const [draft, setDraft] = useState<CellMap | null>(null);
  const roles = useMemo(() => query.data?.roles ?? [], [query.data]);
  const rows = useMemo(() => query.data?.items ?? [], [query.data]);
  const cells = draft ?? base;
  const payloads = draft ? rolePayloads(base, draft, rows, roles) : [];

  const save = useMutation({
    mutationFn: async (list: RolePayload[]) => {
      for (const payload of list) {
        await api.roles.saveCapabilities(payload.roleId, payload.items);
      }
    },
    onSuccess: async () => {
      await refreshAccess(queryClient);
      setDraft(null);
      toast('Permissions saved');
    },
    onError: async (error) => {
      toast(describeError(error).message, 'danger');
      await refreshAccess(queryClient);
    },
  });

  return {
    query,
    canManage,
    roles,
    groups: useMemo(() => groupRows(rows), [rows]),
    dirty: payloads.length > 0,
    cell: (capability: string, roleId: string) => cellOf(cells, capability, roleId),
    isLocked: (capability: string) => isRowLocked(cells, capability, roles),
    isFixed: isFixedRole,
    toggle: (capability: string, roleId: string) =>
      setDraft(toggleCell(cells, capability, roleId, roles)),
    toggleLock: (capability: string) => setDraft(toggleRowLock(cells, capability, roles)),
    discard: () => setDraft(null),
    save,
    submit: () => {
      if (payloads.length) save.mutate(payloads);
    },
  };
}

interface RoleForm {
  name: string;
  copyFromRoleId: string;
}

const EMPTY_ROLE: RoleForm = { name: '', copyFromRoleId: '' };

/** "Create custom role": a name and, optionally, the role whose column it starts from. */
export function useCreateRole(onDone: () => void) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RoleForm>(EMPTY_ROLE);
  const [errors, setErrors] = useState<FieldErrors>({});

  const mutation = useMutation({
    mutationFn: (body: { name: string; copyFromRoleId?: string }) => api.roles.create(body),
    onSuccess: async (role) => {
      await refreshAccess(queryClient);
      toast(`${role.name} created`);
      setForm(EMPTY_ROLE);
      onDone();
    },
    onError: (error) => {
      const fields = serverFieldErrors(error);
      setErrors({ name: fields['name'] ?? describeError(error).message });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(createRoleSchema, {
      name: form.name,
      ...(form.copyFromRoleId ? { copyFromRoleId: form.copyFromRoleId } : {}),
    });
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    mutation.mutate(result.data);
  };

  return {
    form,
    update: (patch: Partial<RoleForm>) => setForm((current) => ({ ...current, ...patch })),
    errors,
    submit,
    mutation,
    reset: () => {
      setForm(EMPTY_ROLE);
      setErrors({});
    },
  };
}
