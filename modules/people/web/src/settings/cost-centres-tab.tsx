import { useT } from '@bemmoly/core-web';
import type { CostCentre } from '@bemmoly/shared/people';
import { Field, FormGrid, Input, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useDirectory, usePeopleById, useSession } from '../shared/queries.ts';
import { EditDialog, SettingsList } from './settings-list.tsx';

/** The kernel's cost centres: a code, a name and the owner who approves what they pay for. */
export function CostCentresTab() {
  const t = useT(peopleText);
  const { can } = useSession();
  const people = usePeopleById();
  const query = useQuery({
    queryKey: peopleKeys.costCentres(),
    queryFn: async () => (await api.org.costCentres.list()).items,
  });
  const [open, setOpen] = useState<CostCentre | 'new' | null>(null);
  const editable = can('workspace.people.manage');
  return (
    <>
      <SettingsList
        label={t('people.settings.costCentres')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyCostCentres')}
        {...(editable ? { onAdd: () => setOpen('new'), onOpen: setOpen } : {})}
        columns={[
          {
            key: 'code',
            header: t('people.settings.code'),
            width: '120px',
            render: (row) => <span className="font-mono text-12">{row.code}</span>,
          },
          {
            key: 'name',
            header: t('people.settings.name'),
            width: 'minmax(160px,2fr)',
            render: (row) => <span className="text-13 font-semibold">{row.name}</span>,
          },
          {
            key: 'owner',
            header: t('people.settings.owner'),
            width: 'minmax(140px,1fr)',
            render: (row) => (
              <span className="text-13 text-tx-2">{people.name(row.ownerUserId) ?? ''}</span>
            ),
          },
        ]}
      />
      {open ? (
        <CostCentreDialog costCentre={open === 'new' ? null : open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function CostCentreDialog({
  costCentre,
  onClose,
}: {
  costCentre: CostCentre | null;
  onClose: () => void;
}) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const everyone = useDirectory();
  const [code, setCode] = useState(costCentre?.code ?? '');
  const [name, setName] = useState(costCentre?.name ?? '');
  const [owner, setOwner] = useState(costCentre?.ownerUserId ?? '');
  const save = useMutation({
    mutationFn: () => {
      const body = { code, name, ownerUserId: owner || null };
      return costCentre
        ? api.org.costCentres.update(costCentre.id, body)
        : api.org.costCentres.create(body);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.settings.saved') });
      onClose();
    },
  });
  return (
    <EditDialog
      title={
        costCentre
          ? t('people.settings.editNamed', { name: costCentre.name })
          : t('people.settings.newCostCentre')
      }
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      error={save.error}
    >
      <FormGrid columns={2}>
        <Field label={t('people.settings.code')}>
          <Input mono value={code} onChange={(event) => setCode(event.target.value)} />
        </Field>
        <Field label={t('people.settings.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </FormGrid>
      <Field label={t('people.settings.owner')}>
        <Select
          searchable
          value={owner}
          placeholder={t('people.edit.pick')}
          onChange={(event) => setOwner(event.value)}
          options={[
            { value: '', label: t('people.profile.none') },
            ...(everyone.data ?? []).map((person) => ({
              value: person.userId,
              label: person.name,
            })),
          ]}
        />
      </Field>
    </EditDialog>
  );
}
