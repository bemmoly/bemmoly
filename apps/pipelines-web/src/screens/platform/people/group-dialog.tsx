import { ApiError } from '@bemmoly/api-client';
import { useT } from '@bemmoly/core-web';
import type { ApprovalGroup } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, useToast, type SelectOption } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { useRoleWrites } from '../../../hooks/use-roles.ts';
import { rolesText } from '../../../i18n/catalog.ts';
import { PickMany } from './pick-many.tsx';

/** A new approval group with its first members, or a new name for one. */
export function GroupDialog({
  open,
  onClose,
  group,
  people,
}: {
  open: boolean;
  onClose: () => void;
  /** Renaming this group; absent for a new one. */
  group: ApprovalGroup | null;
  people: readonly SelectOption[];
}) {
  const t = useT(rolesText);
  const toast = useToast();
  const { createGroup, updateGroup } = useRoleWrites();
  const [name, setName] = useState(group?.name ?? '');
  const [members, setMembers] = useState<string[]>([]);
  const write = group ? updateGroup : createGroup;
  const error = write.error instanceof ApiError ? write.error.message : null;
  const close = () => {
    createGroup.reset();
    updateGroup.reset();
    setName('');
    setMembers([]);
    onClose();
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const done = () => {
      toast.show({ tone: 'ok', title: t('pipelinesRoles.groupDialog.created', { name: trimmed }) });
      close();
    };
    if (group) updateGroup.mutate({ id: group.id, body: { name: trimmed } }, { onSuccess: done });
    else createGroup.mutate({ name: trimmed, members }, { onSuccess: done });
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={
        group
          ? t('pipelinesRoles.groupDialog.renameTitle', { name: group.name })
          : t('pipelinesRoles.groupDialog.title')
      }
      description={t('pipelinesRoles.groupDialog.description')}
      footer={
        <Button
          variant="primary"
          disabled={!name.trim()}
          loading={write.isPending}
          onClick={() => submit()}
        >
          {group ? t('pipelinesRoles.groupDialog.save') : t('pipelinesRoles.groupDialog.create')}
        </Button>
      }
    >
      <form className="flex flex-col gap-3.5" onSubmit={submit}>
        <Field label={t('pipelinesRoles.groupDialog.name')} error={error}>
          <Input
            value={name}
            autoFocus
            placeholder={t('pipelinesRoles.groupDialog.namePlaceholder')}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        {group ? null : (
          <Field
            label={t('pipelinesRoles.groupDialog.members')}
            hint={t('pipelinesRoles.groupDialog.membersHint')}
          >
            <PickMany
              label={t('pipelinesRoles.groupDialog.members')}
              options={people}
              value={members}
              onChange={setMembers}
              placeholder={t('pipelinesRoles.groupDialog.pickPeople')}
              removeLabel={(person) =>
                t('pipelinesRoles.groups.removeMember', { name: person, group: name })
              }
            />
          </Field>
        )}
      </form>
    </Modal>
  );
}
