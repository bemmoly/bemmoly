import { useT } from '@bemmoly/core-web';
import type { ApprovalGroup } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardHeader, IconButton, Menu, MenuItem, Tag } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { rolesText } from '../../../i18n/catalog.ts';

/**
 * Approval groups: who is in each and which approval rules name it. A group in a rule cannot
 * be deleted until the rule stops naming it.
 */
export function GroupsCard({
  groups,
  onNew,
  onAdd,
  onRename,
  onDelete,
  onRemoveMember,
}: {
  groups: readonly ApprovalGroup[];
  onNew: () => void;
  onAdd: (group: ApprovalGroup) => void;
  onRename: (group: ApprovalGroup) => void;
  onDelete: (group: ApprovalGroup) => void;
  onRemoveMember: (group: ApprovalGroup, userId: string, name: string) => void;
}) {
  const t = useT(rolesText);
  return (
    <Card>
      <CardHeader
        title={t('pipelinesRoles.groups.heading')}
        actions={
          <Button size="sm" icon={<Icon name="plus" />} onClick={onNew}>
            {t('pipelinesRoles.groups.new')}
          </Button>
        }
      />
      {groups.length === 0 ? (
        <p className="p-4 text-13 text-tx-2">{t('pipelinesRoles.groups.none')}</p>
      ) : (
        <ul className="flex flex-col">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-2 px-4 py-3 last:border-b-0"
            >
              <span className="min-w-40 text-13 font-semibold text-tx">{group.name}</span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {group.members.length === 0 ? (
                  <span className="text-13 text-tx-3">{t('pipelinesRoles.groups.noMembers')}</span>
                ) : (
                  group.members.map((member) => (
                    <Tag
                      key={member.user.id}
                      onRemove={() => onRemoveMember(group, member.user.id, member.user.name)}
                      removeLabel={t('pipelinesRoles.groups.removeMember', {
                        name: member.user.name,
                        group: group.name,
                      })}
                    >
                      {member.user.name}
                    </Tag>
                  ))
                )}
              </span>
              <span className="text-12 text-tx-3">
                {group.usedBy.length > 0
                  ? t('pipelinesRoles.groups.usedIn', {
                      names: group.usedBy.map((env) => env.name).join(', '),
                    })
                  : t('pipelinesRoles.groups.unused')}
              </span>
              <Button size="sm" onClick={() => onAdd(group)}>
                {t('pipelinesRoles.groups.addPeople')}
              </Button>
              <Menu
                align="end"
                trigger={(props) => (
                  <IconButton
                    {...props}
                    size="sm"
                    label={t('pipelinesRoles.groups.actions', { name: group.name })}
                    icon={<Icon name="more" />}
                  />
                )}
              >
                <MenuItem icon={<Icon name="edit" />} onSelect={() => onRename(group)}>
                  {t('pipelinesRoles.groups.rename')}
                </MenuItem>
                <MenuItem
                  tone="danger"
                  icon={<Icon name="archive" />}
                  onSelect={() => onDelete(group)}
                >
                  {t('pipelinesRoles.groups.delete')}
                </MenuItem>
              </Menu>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
