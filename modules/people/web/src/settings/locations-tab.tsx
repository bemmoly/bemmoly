import { useT } from '@bemmoly/core-web';
import type { Location } from '@bemmoly/shared/people';
import { Field, FormGrid, Input, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { useSession } from '../shared/queries.ts';
import { EditDialog, SettingsList } from './settings-list.tsx';

/** The kernel's locations: name, time zone and country; People's directory reads them. */
export function LocationsTab() {
  const t = useT(peopleText);
  const { can } = useSession();
  const query = useQuery({
    queryKey: peopleKeys.locations(),
    queryFn: async () => (await api.org.locations.list()).items,
  });
  const [open, setOpen] = useState<Location | 'new' | null>(null);
  const editable = can('workspace.people.manage');
  return (
    <>
      <SettingsList
        label={t('people.settings.locations')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyLocations')}
        {...(editable ? { onAdd: () => setOpen('new'), onOpen: setOpen } : {})}
        columns={[
          {
            key: 'name',
            header: t('people.settings.name'),
            width: 'minmax(160px,2fr)',
            render: (row) => <span className="text-13 font-semibold">{row.name}</span>,
          },
          {
            key: 'tz',
            header: t('people.settings.timezone'),
            width: 'minmax(140px,1fr)',
            render: (row) => <span className="text-13 text-tx-2">{row.timezone}</span>,
          },
          {
            key: 'country',
            header: t('people.settings.country'),
            width: '120px',
            render: (row) => <span className="text-13 text-tx-2">{row.countryCode ?? ''}</span>,
          },
        ]}
      />
      {open ? (
        <LocationDialog location={open === 'new' ? null : open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function LocationDialog({ location, onClose }: { location: Location | null; onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState(location?.name ?? '');
  const [timezone, setTimezone] = useState(location?.timezone ?? 'UTC');
  const [country, setCountry] = useState(location?.countryCode ?? '');
  const save = useMutation({
    mutationFn: () => {
      const body = { name, timezone, countryCode: country || null };
      return location
        ? api.org.locations.update(location.id, body)
        : api.org.locations.create(body);
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
        location
          ? t('people.settings.editNamed', { name: location.name })
          : t('people.settings.newLocation')
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
        <Field label={t('people.settings.timezone')} hint={t('people.settings.timezoneHint')}>
          <Input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
        </Field>
        <Field label={t('people.settings.country')}>
          <Input
            value={country}
            maxLength={2}
            onChange={(event) => setCountry(event.target.value)}
          />
        </Field>
      </FormGrid>
    </EditDialog>
  );
}
