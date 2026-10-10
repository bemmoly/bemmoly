import type { Field, FieldKind } from '@bemmoly/module-work/shared';
import { EmptyState, Table, TableSkeleton, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { InlineName } from '../inline-name.tsx';

/** The field kind in plain words. */
export const KINDS: Record<FieldKind, string> = {
  text: 'Text',
  richtext: 'Rich text',
  number: 'Number',
  select: 'Select',
  multiselect: 'Multi-select',
  user: 'Person',
  date: 'Date',
  datetime: 'Date and time',
  url: 'Link',
  doc: 'Doc',
};

/**
 * Custom fields as one table: the name renamed in place, its kind, its options, whether it
 * filters, and where it comes from. The AI mark is lilac, the one colour kept for AI.
 */
export function FieldsTable({
  rows,
  loading,
  editable,
  onRename,
}: {
  rows: readonly Field[];
  loading: boolean;
  editable: boolean;
  onRename: (field: Field, name: string) => void;
}) {
  const columns: TableColumn<Field>[] = [
    {
      key: 'name',
      header: 'Field',
      width: 'minmax(0,1fr)',
      render: (field) => (
        <span className="flex min-w-0 items-center gap-2">
          <InlineName
            value={field.name}
            label={`Rename ${field.name}`}
            editable={editable}
            onRename={(name) => onRename(field, name)}
            className="font-medium"
          />
          {field.aiFill && (
            <span className="flex shrink-0 items-center gap-1 text-12 text-ai-600" title="AI suggests a value">
              <Icon name="spark" size={12} />
              AI fills
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'kind',
      header: 'Kind',
      width: '120px',
      render: (field) => <span className="text-tx-2">{KINDS[field.kind]}</span>,
    },
    {
      key: 'options',
      header: 'Options',
      width: '84px',
      hideOnPhone: true,
      render: (field) => (
        <span className="text-tx-3 tabular-nums">
          {field.options.length > 0 ? field.options.length : 'None'}
        </span>
      ),
    },
    {
      key: 'filter',
      header: 'Filterable',
      width: '84px',
      hideOnPhone: true,
      render: (field) =>
        field.filterable ? (
          <Icon name="check" size={14} className="text-tx-2" aria-label="Filterable" />
        ) : (
          <span className="sr-only">Not filterable</span>
        ),
    },
    {
      key: 'source',
      header: 'Source',
      width: '96px',
      render: (field) =>
        field.projectId && !field.originId ? (
          <span className="text-12 font-semibold text-ac">This project</span>
        ) : (
          <span className="text-12 text-tx-3">Default</span>
        ),
    },
  ];
  if (loading)
    return (
      <TableSkeleton
        label="Loading fields"
        rows={6}
        columns={columns.map((column) => ({ width: column.width }))}
      />
    );
  return (
    <Table
      label="Custom fields"
      columns={columns}
      rows={rows}
      rowKey={(field) => field.id}
      empty={
        <EmptyState
          icon={<Icon name="list" />}
          title="No custom fields yet"
          description="Fields add what your issues need beyond the basics, like severity or a design link."
        />
      }
    />
  );
}
