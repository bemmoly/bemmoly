import { useT } from '@bemmoly/core-web';
import { Badge, Checkbox, Field, FormGrid, Input, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { LEAVE_KINDS, type LeaveKind, type LeavePolicy } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useOrgLookups } from '../shared/queries.ts';
import { EditDialog, SettingsList } from './settings-list.tsx';

/** Leave policies: a type, where it applies, its days a year, and whether it needs approval. */
export function LeaveTab() {
  const t = useT(peopleText);
  const org = useOrgLookups();
  const query = useQuery({
    queryKey: peopleKeys.policies(true),
    queryFn: async () => (await api.people.leave.policies(true)).items,
  });
  const [open, setOpen] = useState<LeavePolicy | 'new' | null>(null);
  return (
    <>
      <SettingsList
        label={t('people.settings.leave')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyPolicies')}
        onAdd={() => setOpen('new')}
        onOpen={setOpen}
        columns={[
          {
            key: 'name',
            header: t('people.settings.name'),
            width: 'minmax(180px,2fr)',
            render: (row) => (
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-13 font-semibold">{row.name}</span>
                {row.archived ? (
                  <Badge tone="outline">{t('people.settings.archivedBadge')}</Badge>
                ) : null}
              </span>
            ),
          },
          {
            key: 'kind',
            header: t('people.settings.kind'),
            width: '130px',
            render: (row) => (
              <span className="text-13 text-tx-2">{t(`people.kind.${row.kind}`)}</span>
            ),
          },
          {
            key: 'where',
            header: t('people.settings.location'),
            width: '140px',
            hideOnPhone: true,
            render: (row) => (
              <span className="text-13 text-tx-2">
                {org.location(row.locationId)?.name ?? t('people.settings.everywhere')}
              </span>
            ),
          },
          {
            key: 'days',
            header: t('people.settings.allowance'),
            width: '120px',
            align: 'end',
            render: (row) => (
              <span className="text-13 tabular-nums">
                {row.allowanceDays ?? t('people.timeOff.noLimit')}
              </span>
            ),
          },
        ]}
      />
      {open ? (
        <PolicyDialog policy={open === 'new' ? null : open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function PolicyDialog({ policy, onClose }: { policy: LeavePolicy | null; onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const org = useOrgLookups();
  const [name, setName] = useState(policy?.name ?? '');
  const [kind, setKind] = useState<LeaveKind>(policy?.kind ?? 'annual');
  const [locationId, setLocationId] = useState(policy?.locationId ?? '');
  const [allowance, setAllowance] = useState(policy?.allowanceDays?.toString() ?? '');
  const [carry, setCarry] = useState(policy?.carryOverDays.toString() ?? '0');
  const [needsApproval, setNeedsApproval] = useState(policy?.needsApproval ?? true);
  const [archived, setArchived] = useState(policy?.archived ?? false);
  const save = useMutation({
    mutationFn: () => {
      const allowanceDays = allowance.trim() === '' ? null : Number(allowance);
      const carryOverDays = Number(carry || 0);
      return policy
        ? api.people.leave.updatePolicy(policy.id, {
            name,
            allowanceDays,
            carryOverDays,
            needsApproval,
            archived,
          })
        : api.people.leave.createPolicy({
            name,
            kind,
            locationId: locationId || null,
            allowanceDays,
            carryOverDays,
            needsApproval,
          });
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
        policy
          ? t('people.settings.editNamed', { name: policy.name })
          : t('people.settings.newPolicy')
      }
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      error={save.error}
    >
      <Field label={t('people.settings.name')}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <FormGrid columns={2}>
        <Field label={t('people.settings.kind')}>
          <Select
            value={kind}
            disabled={Boolean(policy)}
            onChange={(event) => setKind(event.value as LeaveKind)}
            options={LEAVE_KINDS.map((value) => ({ value, label: t(`people.kind.${value}`) }))}
          />
        </Field>
        <Field label={t('people.settings.location')}>
          <Select
            value={locationId}
            disabled={Boolean(policy)}
            onChange={(event) => setLocationId(event.value)}
            options={[
              { value: '', label: t('people.settings.everywhere') },
              ...org.locations.map((place) => ({ value: place.id, label: place.name })),
            ]}
          />
        </Field>
        <Field label={t('people.settings.allowance')} hint={t('people.settings.allowanceHint')}>
          <Input
            inputMode="decimal"
            value={allowance}
            onChange={(event) => setAllowance(event.target.value)}
          />
        </Field>
        <Field label={t('people.settings.carryOver')}>
          <Input
            inputMode="decimal"
            value={carry}
            onChange={(event) => setCarry(event.target.value)}
          />
        </Field>
      </FormGrid>
      <Checkbox
        label={t('people.settings.needsApproval')}
        checked={needsApproval}
        onChange={(event) => setNeedsApproval(event.target.checked)}
      />
      {policy ? (
        <Checkbox
          label={t('people.settings.archive')}
          checked={archived}
          onChange={(event) => setArchived(event.target.checked)}
        />
      ) : null}
    </EditDialog>
  );
}
