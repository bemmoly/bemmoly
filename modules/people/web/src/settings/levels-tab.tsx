import { useT } from '@bemmoly/core-web';
import { Button, Field, Input, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Level } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { EditDialog, SettingsList } from './settings-list.tsx';

/** The career ladder a profile's level is picked from, lowest first. */
export function LevelsTab() {
  const t = useT(peopleText);
  const query = useQuery({
    queryKey: peopleKeys.levels(),
    queryFn: async () => (await api.people.levels.list()).items,
  });
  const [open, setOpen] = useState<Level | 'new' | null>(null);
  return (
    <>
      <SettingsList
        label={t('people.settings.levels')}
        query={query}
        rowKey={(row) => row.id}
        empty={t('people.settings.emptyLevels')}
        onAdd={() => setOpen('new')}
        onOpen={setOpen}
        columns={[
          {
            key: 'name',
            header: t('people.settings.name'),
            width: '160px',
            render: (row) => <span className="text-13 font-semibold">{row.name}</span>,
          },
          {
            key: 'description',
            header: t('people.settings.description'),
            width: 'minmax(200px,1fr)',
            render: (row) => (
              <span className="truncate text-13 text-tx-2">{row.description ?? ''}</span>
            ),
          },
        ]}
      />
      {open ? (
        <LevelDialog level={open === 'new' ? null : open} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}

function LevelDialog({ level, onClose }: { level: Level | null; onClose: () => void }) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState(level?.name ?? '');
  const [description, setDescription] = useState(level?.description ?? '');
  const done = async (title: string) => {
    await client.invalidateQueries({ queryKey: peopleKeys.levels() });
    toast.show({ tone: 'ok', title });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => {
      const body = { name, description: description || null };
      return level ? api.people.levels.update(level.id, body) : api.people.levels.create(body);
    },
    onSuccess: () => done(t('people.settings.saved')),
  });
  const remove = useMutation({
    mutationFn: () => api.people.levels.remove(level!.id),
    onSuccess: () => done(t('people.settings.deleted')),
  });
  return (
    <EditDialog
      title={
        level ? t('people.settings.editNamed', { name: level.name }) : t('people.settings.newLevel')
      }
      onClose={onClose}
      onSave={() => save.mutate()}
      saving={save.isPending}
      error={save.error ?? remove.error}
    >
      <Field label={t('people.settings.name')}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label={t('people.settings.description')}>
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      {level ? (
        <Button
          variant="danger"
          size="sm"
          className="self-start"
          loading={remove.isPending}
          onClick={() => remove.mutate()}
        >
          {t('people.settings.delete')}
        </Button>
      ) : null}
    </EditDialog>
  );
}
