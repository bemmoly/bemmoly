import type { OrgTemplate } from '@bemmoly/module-docs/shared';
import {
  Badge,
  IconButton,
  Menu,
  MenuItem,
  RelativeTime,
  Table,
  TableSkeleton,
  rowReveal,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon, PageIcon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { moved, useDragList } from './use-drag-list.ts';

export interface TemplateActions {
  open: (template: OrgTemplate) => void;
  edit: (template: OrgTemplate) => void;
  duplicate: (template: OrgTemplate) => void;
  setArchived: (template: OrgTemplate, archived: boolean) => void;
  /** The active templates' ids in their new order. */
  reorder: (ids: string[]) => void;
}

/** "engineering" as people read it: "Engineering". */
export const categoryLabel = (category: string | null) =>
  category ? category.charAt(0).toUpperCase() + category.slice(1) : 'General';

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** The row's ··· menu: everything a row offers, also in the read view. */
export function TemplateMenu({
  template,
  actions,
}: {
  template: OrgTemplate;
  actions: TemplateActions;
}) {
  const archived = template.archivedAt !== null;
  return (
    <Menu
      align="end"
      trigger={(trigger) => (
        <IconButton {...trigger} label={`Actions for ${template.name}`} icon="more" size="sm" />
      )}
    >
      <MenuItem icon={<Icon name="eye" size={14} />} onSelect={() => actions.open(template)}>
        Preview
      </MenuItem>
      {!template.isBuiltin && !archived && (
        <MenuItem icon={<Icon name="edit" size={14} />} onSelect={() => actions.edit(template)}>
          Edit
        </MenuItem>
      )}
      {!archived && (
        <MenuItem
          icon={<Icon name="copy" size={14} />}
          onSelect={() => actions.duplicate(template)}
        >
          {template.isBuiltin ? 'Duplicate to edit' : 'Duplicate'}
        </MenuItem>
      )}
      {archived ? (
        <MenuItem
          icon={<Icon name="restore" size={14} />}
          onSelect={() => actions.setArchived(template, false)}
        >
          Restore
        </MenuItem>
      ) : (
        <MenuItem
          icon={<Icon name="archive" size={14} />}
          onSelect={() => actions.setArchived(template, true)}
        >
          Archive
        </MenuItem>
      )}
    </Menu>
  );
}

function nameCell(template: OrgTemplate) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-chip bg-line-2 text-tx-3">
        <PageIcon value={template.icon} size={15} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-semibold text-tx">{template.name}</span>
          {template.isBuiltin && <Badge tone="neutral">Built-in</Badge>}
        </span>
        {template.description && (
          <span className="truncate text-12 text-tx-3" title={template.description}>
            {template.description}
          </span>
        )}
      </span>
    </span>
  );
}

function createdCell(template: OrgTemplate) {
  if (template.isBuiltin) return <span className="text-12 text-tx-3">With Bemmoly</span>;
  return (
    <span className="flex min-w-0 flex-col gap-px text-12">
      <span className="truncate text-tx-2">{template.createdBy?.name ?? 'Someone'}</span>
      <RelativeTime iso={template.createdAt} className="text-tx-3" />
    </span>
  );
}

/**
 * The org templates as the one table: a grip to reorder (drag, or ↑↓ on the grip) while the
 * whole active list shows, the template, its category, how many fields its page form asks for,
 * how many pages it started, who added it, and its ··· menu. A row opens its read view.
 */
export function TemplatesTable({
  rows,
  loading,
  reorderable,
  actions,
  empty,
}: {
  rows: readonly OrgTemplate[];
  loading: boolean;
  reorderable: boolean;
  actions: TemplateActions;
  empty: ReactNode;
}) {
  const drag = useDragList({
    disabled: !reorderable,
    onMove: (from, to) => actions.reorder(moved(rows, from, to).map((row) => row.id)),
  });
  const columns: TableColumn<OrgTemplate>[] = [
    ...(reorderable
      ? [
          {
            key: 'grip',
            header: <span className="sr-only">Reorder</span>,
            width: '20px',
            render: (template: OrgTemplate) => (
              <span
                {...drag.handle(rows.indexOf(template), rows.length)}
                role="button"
                tabIndex={0}
                aria-label={`Move ${template.name}; use the up and down arrow keys`}
                onClick={(event) => event.stopPropagation()}
                className={`flex cursor-grab rounded-chip text-tx-3 ${rowReveal} focus-visible:shadow-ring focus-visible:outline-0`}
              >
                <Icon name="drag" size={14} />
              </span>
            ),
          },
        ]
      : []),
    { key: 'name', header: 'Template', width: 'minmax(0,1fr)', render: nameCell },
    {
      key: 'category',
      header: 'Category',
      width: '120px',
      hideOnPhone: true,
      render: (template) => (
        <span className="truncate text-tx-2">{categoryLabel(template.category)}</span>
      ),
    },
    {
      key: 'fields',
      header: 'Fields',
      width: '72px',
      hideOnPhone: true,
      render: (template) => (
        <span className="text-tx-2 tabular-nums">{template.fields.length}</span>
      ),
    },
    {
      key: 'used',
      header: 'Used by',
      width: '88px',
      hideOnPhone: true,
      render: (template) => (
        <span className="text-tx-2 tabular-nums">{count(template.usedBy, 'page', 'pages')}</span>
      ),
    },
    { key: 'created', header: 'Added', width: '112px', hideOnPhone: true, render: createdCell },
    {
      key: 'menu',
      header: <span className="sr-only">Actions</span>,
      width: '32px',
      align: 'end',
      reveal: true,
      render: (template) => (
        // The menu's own clicks and keys stay in the menu, not on the row that opens.
        <span onClick={(event) => event.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <TemplateMenu template={template} actions={actions} />
        </span>
      ),
    },
  ];
  if (loading) {
    return (
      <TableSkeleton
        label="Loading templates"
        rows={6}
        columns={columns.map((column) => ({ width: column.width }))}
      />
    );
  }
  return (
    <Table
      label="Org templates"
      columns={columns}
      rows={rows}
      rowKey={(template) => template.id}
      onRowClick={actions.open}
      isMuted={(template) => template.archivedAt !== null}
      empty={empty}
      rowProps={(_, index) => ({
        ...drag.item(index),
        'data-over': drag.over === index && drag.dragging !== index,
      })}
    />
  );
}
