import { navigateInApp, useT } from '@bemmoly/core-web';
import { Button, Field, Modal, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { DirectoryRow } from '../../../shared/index.ts';
import { peopleText } from '../i18n/catalog.ts';
import { api } from '../shared/api.ts';
import { peopleKeys } from '../shared/keys.ts';
import { peoplePaths } from '../shared/paths.ts';

/**
 * Gives an existing account an employment record (the kernel's POST /people), then opens the
 * new profile so its facts can be filled in.
 */
export function AddPersonDialog({
  open,
  onClose,
  known,
}: {
  open: boolean;
  onClose: () => void;
  known: ReadonlyMap<string, DirectoryRow>;
}) {
  const t = useT(peopleText);
  const toast = useToast();
  const client = useQueryClient();
  const [userId, setUserId] = useState('');
  const users = useQuery({
    queryKey: [...peopleKeys.all(), 'accounts'],
    queryFn: async () => (await api.users.list({ limit: 200 })).items,
    enabled: open,
  });
  const candidates = (users.data ?? []).filter((user) => !known.has(user.id));
  const create = useMutation({
    mutationFn: () => api.org.people.create({ userId, state: 'active' }),
    onSuccess: async (person) => {
      await client.invalidateQueries({ queryKey: peopleKeys.all() });
      toast.show({ tone: 'ok', title: t('people.add.added', { name: person.name }) });
      onClose();
      navigateInApp(peoplePaths.profile(person.userId));
    },
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('people.add.title')}
      description={t('people.add.description')}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('people.edit.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={!userId}
            loading={create.isPending}
            onClick={() => create.mutate()}
          >
            {t('people.add.save')}
          </Button>
        </>
      }
    >
      <Field
        label={t('people.add.user')}
        hint={candidates.length === 0 && users.isSuccess ? t('people.add.noUsers') : undefined}
        error={create.error?.message}
      >
        <Select
          value={userId}
          placeholder={t('people.add.pickUser')}
          searchable
          onChange={(event) => setUserId(event.value)}
          options={candidates.map((user) => ({
            value: user.id,
            label: user.name,
            description: user.email,
          }))}
        />
      </Field>
    </Modal>
  );
}
