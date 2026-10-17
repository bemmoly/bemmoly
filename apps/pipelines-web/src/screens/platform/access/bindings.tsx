import { formatDateTime, useT } from '@bemmoly/core-web';
import type { RoleBinding } from '@bemmoly/module-pipelines/shared';
import {
  Avatar,
  EmptyState,
  EntityTile,
  IconButton,
  Menu,
  MenuItem,
  Table,
  Tag,
  useToast,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useBindingWrites } from '../../../hooks/use-access.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';

const nameOf = (binding: RoleBinding) =>
  binding.subject.kind === 'team' ? binding.subject.team.name : binding.subject.user.name;

/** Puts a removed binding back as it was, for Undo. */
function recreate(binding: RoleBinding) {
  return {
    subject: {
      kind: binding.subject.kind,
      id: binding.subject.kind === 'team' ? binding.subject.team.id : binding.subject.user.id,
    },
    role: binding.role,
    scope: { kind: binding.scope.kind, ...(binding.scope.id ? { id: binding.scope.id } : {}) },
    ...(binding.environmentClass ? { environmentClass: binding.environmentClass } : {}),
    ...(binding.expiresAt ? { expiresAt: binding.expiresAt } : {}),
    ...(binding.reason ? { reason: binding.reason } : {}),
  };
}

/**
 * The role bindings that apply at the scope: its own first, then those inherited from wider
 * scopes, marked as such. Only a binding made here can be removed here, with Undo.
 */
export function Bindings({ items }: { items: readonly RoleBinding[] }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const writes = useBindingWrites();
  const remove = (binding: RoleBinding) => {
    if (!binding.id) return;
    writes.remove.mutate(binding.id, {
      onSuccess: () =>
        toast.undo({
          title: t('pipelines.access.removed', {
            role: t(`pipelines.role.${binding.role}`),
            who: nameOf(binding),
          }),
          onUndo: () => writes.create.mutate(recreate(binding)),
        }),
      onError: (error) =>
        toast.show({
          tone: 'danger',
          title: t('pipelines.access.removeFailed'),
          body: refusalOf(error)?.sentence ?? t('pipelines.common.loadFailed'),
        }),
    });
  };
  const columns: TableColumn<RoleBinding>[] = [
    {
      key: 'who',
      header: t('pipelines.access.who'),
      width: 'minmax(0,1.5fr)',
      render: (binding) => (
        <span className="flex min-w-0 items-center gap-2">
          {binding.subject.kind === 'team' ? (
            <EntityTile name={binding.subject.team.name} size={20} />
          ) : (
            <Avatar name={binding.subject.user.name} size={20} />
          )}
          <span className="truncate font-medium text-tx">{nameOf(binding)}</span>
          {binding.expiresAt && (
            <span className="shrink-0 text-12 text-tx-3">
              {t('pipelines.access.until', { time: formatDateTime(binding.expiresAt) })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'role',
      header: t('pipelines.access.role'),
      width: 'minmax(120px,0.8fr)',
      render: (binding) => (
        <span className="flex flex-wrap items-center gap-1">
          <Tag>{t(`pipelines.role.${binding.role}`)}</Tag>
          {binding.environmentClass && (
            <Tag size="sm">
              {t('pipelines.access.onlyIn', {
                env: t(`pipelines.envClass.${binding.environmentClass}`),
              })}
            </Tag>
          )}
        </span>
      ),
    },
    {
      key: 'scope',
      header: t('pipelines.access.boundAt'),
      width: 'minmax(120px,0.8fr)',
      hideOnPhone: true,
      render: (binding) =>
        binding.implicit ? (
          <span className="text-12 text-tx-2">{t('pipelines.access.implicit')}</span>
        ) : binding.inherited ? (
          <span className="truncate text-12 text-tx-3">
            {t('pipelines.access.inherited', {
              scope: binding.inheritedFrom?.name ?? binding.scope.name,
            })}
          </span>
        ) : (
          <span className="truncate text-12 text-tx">{binding.scope.name}</span>
        ),
    },
    {
      key: 'menu',
      header: '',
      width: '32px',
      align: 'end',
      render: (binding) =>
        binding.id && !binding.inherited && !binding.implicit ? (
          <Menu
            align="end"
            trigger={(props) => (
              <IconButton
                {...props}
                size="sm"
                variant="ghost"
                label={t('pipelines.access.rowMenu')}
                icon="more"
              />
            )}
          >
            <MenuItem
              tone="danger"
              icon={<Icon name="trash" size={14} />}
              onSelect={() => remove(binding)}
            >
              {t('pipelines.access.remove')}
            </MenuItem>
          </Menu>
        ) : null,
    },
  ];
  return (
    <Table
      label={t('pipelines.access.bindingsLabel', { scope: items[0]?.scope.name ?? '' })}
      columns={columns}
      rows={items}
      rowKey={(binding) => binding.id ?? `implicit:${nameOf(binding)}`}
      empty={
        <EmptyState
          size="sm"
          icon={<Icon name="lock" size={18} />}
          title={t('pipelines.access.emptyTitle')}
          description={t('pipelines.access.emptyDescription')}
        />
      }
    />
  );
}
