import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import type { ApprovalGroup } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Modal, useToast, type SelectOption } from '@bemmoly/ui';
import { useState } from 'react';
import { useRoleWrites } from '../../../hooks/use-roles.ts';
import { rolesText } from '../../../i18n/catalog.ts';
import { PickMany } from './pick-many.tsx';

/** More people into one approval group: only people with a role, and not ones already in. */
export function AddMembersDialog({
  group,
  people,
  onClose,
}: {
  group: ApprovalGroup | null;
  people: readonly SelectOption[];
  onClose: () => void;
}) {
  const t = useT(rolesText);
  const toast = useToast();
  const { addMembers } = useRoleWrites();
  const [users, setUsers] = useState<string[]>([]);
  const inGroup = new Set(group?.members.map((member) => member.user.id) ?? []);
  const close = () => {
    addMembers.reset();
    setUsers([]);
    onClose();
  };
  const submit = () => {
    if (!group || users.length === 0) return;
    addMembers.mutate(
      { id: group.id, users },
      {
        onSuccess: () => {
          toast.show({
            tone: 'ok',
            title: t('pipelinesRoles.addMembers.added', { group: group.name }),
          });
          close();
        },
      },
    );
  };
  const name = group?.name ?? '';
  return (
    <Modal
      open={group !== null}
      onClose={close}
      title={t('pipelinesRoles.addMembers.title', { group: name })}
      footer={
        <Button
          variant="primary"
          disabled={users.length === 0}
          loading={addMembers.isPending}
          onClick={submit}
        >
          {t('pipelinesRoles.addMembers.add')}
        </Button>
      }
    >
      <Field
        label={t('pipelinesRoles.groupDialog.members')}
        hint={t('pipelinesRoles.groupDialog.membersHint')}
        error={addMembers.error instanceof ApiError ? addMembers.error.message : null}
      >
        <PickMany
          label={t('pipelinesRoles.groupDialog.members')}
          options={people.filter((person) => !inGroup.has(person.value))}
          value={users}
          onChange={setUsers}
          placeholder={t('pipelinesRoles.groupDialog.pickPeople')}
          removeLabel={(person) =>
            t('pipelinesRoles.groups.removeMember', { name: person, group: name })
          }
        />
      </Field>
    </Modal>
  );
}
