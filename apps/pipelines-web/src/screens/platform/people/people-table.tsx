import { useT } from '@bemmoly/core-web';
import {
  personRoleSchema,
  type PersonRole,
  type PipelinesPerson,
} from '@bemmoly/module-pipelines/shared';
import {
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Select,
  Table,
  Tag,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { rolesText } from '../../../i18n/catalog.ts';

const None = ({ label }: { label: string }) => <span className="text-12 text-tx-3">{label}</span>;

/**
 * Everyone with a role: their role (changed in place), the approval groups they approve as,
 * and where they deploy without approval. Your own role is another admin's to change.
 */
export function PeopleTable({
  people,
  me,
  environmentName,
  onRole,
  onRemove,
}: {
  people: readonly PipelinesPerson[];
  me: string;
  environmentName: (key: string) => string;
  onRole: (person: PipelinesPerson, role: PersonRole) => void;
  onRemove: (person: PipelinesPerson) => void;
}) {
  const t = useT(rolesText);
  const roleOptions = personRoleSchema.options.map((value) => ({
    value,
    label: t(`pipelinesRoles.role.${value}`),
  }));
  const columns: TableColumn<PipelinesPerson>[] = [
    {
      key: 'person',
      header: t('pipelinesRoles.people.person'),
      width: 'minmax(0,1.4fr)',
      render: (person) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={person.user.name} size={24} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-tx">{person.user.name}</span>
            {person.pending ? null : (
              <span className="truncate text-12 text-tx-3">{person.email}</span>
            )}
          </span>
          {person.user.id === me && <Tag>{t('pipelinesRoles.people.you')}</Tag>}
          {person.pending && <Tag>{t('pipelinesRoles.people.invited')}</Tag>}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('pipelinesRoles.people.role'),
      width: 'minmax(150px,0.8fr)',
      render: (person) =>
        person.user.id === me || person.pending ? (
          <span className="px-2.5 text-13 text-tx">{t(`pipelinesRoles.role.${person.role}`)}</span>
        ) : (
          <Select
            size="sm"
            variant="ghost"
            aria-label={t('pipelinesRoles.people.roleOf', { name: person.user.name })}
            value={person.role}
            options={roleOptions}
            onChange={(event) => onRole(person, event.value as PersonRole)}
          />
        ),
    },
    {
      key: 'groups',
      header: t('pipelinesRoles.people.approvesAs'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (person) =>
        person.groups.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {person.groups.map((group) => (
              <Tag key={group.id} tone="accent">
                {group.name}
              </Tag>
            ))}
          </span>
        ) : (
          <None label={t('pipelinesRoles.people.none')} />
        ),
    },
    {
      key: 'deploys',
      header: t('pipelinesRoles.people.deploysTo'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (person) =>
        person.deploysTo.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {person.deploysTo.map((key) => (
              <Tag key={key}>{environmentName(key)}</Tag>
            ))}
          </span>
        ) : (
          <None label={t('pipelinesRoles.people.none')} />
        ),
    },
    {
      key: 'more',
      header: '',
      width: '40px',
      align: 'end',
      reveal: true,
      render: (person) =>
        person.user.id === me ? null : (
          <Menu
            align="end"
            trigger={(props) => (
              <IconButton
                {...props}
                size="sm"
                label={t('pipelinesRoles.people.actions', { name: person.user.name })}
                icon={<Icon name="more" />}
              />
            )}
          >
            <MenuItem tone="danger" icon={<Icon name="user-x" />} onSelect={() => onRemove(person)}>
              {person.pending
                ? t('pipelinesRoles.people.revoke')
                : t('pipelinesRoles.people.remove')}
            </MenuItem>
          </Menu>
        ),
    },
  ];
  return (
    <Table
      label={t('pipelinesRoles.people.heading')}
      columns={columns}
      rows={people}
      rowKey={(person) => person.user.id}
    />
  );
}
