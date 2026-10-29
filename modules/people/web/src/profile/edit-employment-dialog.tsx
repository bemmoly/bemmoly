import { useT } from '@bemmoly/core-web';
import { EMPLOYMENT_STATES, canTransition, type UpdatePersonInput } from '@bemmoly/shared/people';
import { Button, Field, FormGrid, Input, Modal, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useDirectory, useOrgLookups } from '../shared/queries.ts';

const NONE = '';

/** Edits the kernel's person record (PATCH /api/v1/people/:userId); the kernel checks rights. */
export function EditEmploymentDialog({
  person,
  onClose,
}: {
  person: DirectoryRow;
  onClose: () => void;
}) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const org = useOrgLookups();
  const everyone = useDirectory();
  const [draft, setDraft] = useState({
    state: person.state,
    jobTitle: person.jobTitle ?? '',
    level: person.level ?? NONE,
    managerId: person.managerId ?? NONE,
    teamId: person.teamId ?? NONE,
    locationId: person.locationId ?? NONE,
    costCentreId: person.costCentreId ?? NONE,
    startDate: person.startDate ?? '',
    endDate: person.endDate ?? '',
  });
  const set = (key: keyof typeof draft) => (value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const orNull = (value: string) => (value === NONE ? null : value);
  const save = useMutation({
    mutationFn: () => {
      const body: UpdatePersonInput = {
        state: draft.state,
        jobTitle: orNull(draft.jobTitle.trim()),
        level: orNull(draft.level),
        managerId: orNull(draft.managerId),
        teamId: orNull(draft.teamId),
        locationId: orNull(draft.locationId),
        costCentreId: orNull(draft.costCentreId),
        startDate: orNull(draft.startDate),
        endDate: orNull(draft.endDate),
      };
      return api.org.people.update(person.userId, body);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.edit.saved') });
      onClose();
    },
  });
  const none = { value: NONE, label: t('people.profile.none') };
  const choose = (items: readonly { value: string; label: string }[]) => [none, ...items];
  return (
    <Modal
      open
      onClose={onClose}
      title={t('people.edit.title')}
      description={person.name}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('people.edit.cancel')}
          </Button>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            {t('people.edit.save')}
          </Button>
        </>
      }
    >
      {save.error ? <p className="m-0 mb-3 text-13 text-red-tx">{save.error.message}</p> : null}
      <FormGrid columns={2}>
        <Field label={t('people.profile.state')}>
          <Select
            value={draft.state}
            onChange={(event) => set('state')(event.value)}
            options={EMPLOYMENT_STATES.filter((state) => canTransition(person.state, state)).map(
              (state) => ({ value: state, label: t(`people.state.${state}`) }),
            )}
          />
        </Field>
        <Field label={t('people.profile.jobTitle')}>
          <Input value={draft.jobTitle} onChange={(event) => set('jobTitle')(event.target.value)} />
        </Field>
        <Field label={t('people.profile.manager')}>
          <Select
            searchable
            value={draft.managerId}
            onChange={(event) => set('managerId')(event.value)}
            options={choose(
              (everyone.data ?? [])
                .filter((other) => other.userId !== person.userId)
                .map((other) => ({ value: other.userId, label: other.name })),
            )}
          />
        </Field>
        <Field label={t('people.profile.level')}>
          <Select
            value={draft.level}
            onChange={(event) => set('level')(event.value)}
            options={choose(org.levels.map((level) => ({ value: level.name, label: level.name })))}
          />
        </Field>
        <Field label={t('people.profile.team')}>
          <Select
            value={draft.teamId}
            onChange={(event) => set('teamId')(event.value)}
            options={choose(org.teams.map((team) => ({ value: team.id, label: team.name })))}
          />
        </Field>
        <Field label={t('people.profile.location')}>
          <Select
            value={draft.locationId}
            onChange={(event) => set('locationId')(event.value)}
            options={choose(org.locations.map((place) => ({ value: place.id, label: place.name })))}
          />
        </Field>
        <Field label={t('people.profile.costCentre')}>
          <Select
            value={draft.costCentreId}
            onChange={(event) => set('costCentreId')(event.value)}
            options={choose(
              org.costCentres.map((cc) => ({ value: cc.id, label: `${cc.code} · ${cc.name}` })),
            )}
          />
        </Field>
        <Field label={t('people.profile.startDate')}>
          <Input
            type="date"
            value={draft.startDate}
            onChange={(event) => set('startDate')(event.target.value)}
          />
        </Field>
        <Field label={t('people.profile.endDate')}>
          <Input
            type="date"
            value={draft.endDate}
            onChange={(event) => set('endDate')(event.target.value)}
          />
        </Field>
      </FormGrid>
    </Modal>
  );
}
