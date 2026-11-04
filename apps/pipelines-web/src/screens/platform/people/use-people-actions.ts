import { useT } from '@bemmoly/core-web';
import type { ApprovalGroup, PersonRole, PipelinesPerson } from '@bemmoly/module-pipelines/shared';
import { useToast } from '@bemmoly/ui';
import { useRoleWrites } from '../../../hooks/use-roles.ts';
import { rolesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';

/** The writes behind People and roles, each confirmed or explained in a toast. */
export function usePeopleActions() {
  const t = useT(rolesText);
  const toast = useToast();
  const writes = useRoleWrites();
  const failed = (error: unknown) =>
    toast.show({
      tone: 'danger',
      title: t('pipelinesRoles.people.failed'),
      body: refusalOf(error)?.sentence ?? (error instanceof Error ? error.message : ''),
    });
  return {
    setRole(person: PipelinesPerson, role: PersonRole) {
      writes.setRole.mutate(
        { userId: person.user.id, role },
        {
          onSuccess: () =>
            toast.show({
              tone: 'ok',
              title: t('pipelinesRoles.people.roleChanged', {
                name: person.user.name,
                role: t(`pipelinesRoles.role.${role}`),
              }),
            }),
          onError: failed,
        },
      );
    },
    remove(person: PipelinesPerson) {
      const done = () =>
        toast.show({
          tone: 'ok',
          title: person.pending
            ? t('pipelinesRoles.people.revoked', { email: person.email })
            : t('pipelinesRoles.people.removed', { name: person.user.name }),
        });
      if (person.pending) {
        writes.revokeInvitation.mutate(person.user.id, { onSuccess: done, onError: failed });
      } else writes.removePerson.mutate(person.user.id, { onSuccess: done, onError: failed });
    },
    deleteGroup(group: ApprovalGroup) {
      writes.removeGroup.mutate(group.id, {
        onSuccess: () =>
          toast.show({
            tone: 'ok',
            title: t('pipelinesRoles.groups.deleted', { name: group.name }),
          }),
        onError: failed,
      });
    },
    removeMember(group: ApprovalGroup, userId: string, name: string) {
      writes.removeMember.mutate(
        { id: group.id, userId },
        {
          onSuccess: () =>
            toast.show({
              tone: 'ok',
              title: t('pipelinesRoles.groups.memberRemoved', { name, group: group.name }),
            }),
          onError: failed,
        },
      );
    },
  };
}
