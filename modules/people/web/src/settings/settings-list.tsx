import { HeaderActions, useT } from '@bemmoly/core-web';
import { Button, Modal, Table, TableSkeleton, type TableColumn } from '@bemmoly/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { peopleText } from '../i18n/catalog.ts';
import { LoadError } from '../shared/states.tsx';

/** One settings section: an Add button in the header and the table of what exists. */
export function SettingsList<T>({
  label,
  query,
  columns,
  rowKey,
  empty,
  onAdd,
  onOpen,
}: {
  label: string;
  query: UseQueryResult<readonly T[]>;
  columns: readonly TableColumn<T>[];
  rowKey: (row: T) => string;
  empty: string;
  onAdd?: () => void;
  onOpen?: (row: T) => void;
}) {
  const t = useT(peopleText);
  return (
    <>
      {onAdd ? (
        <HeaderActions>
          <Button variant="primary" onClick={onAdd}>
            {t('people.settings.add')}
          </Button>
        </HeaderActions>
      ) : null}
      {query.isPending ? (
        <TableSkeleton
          label={t('people.loading')}
          rows={4}
          columns={columns.map((column) => ({ width: column.width }))}
        />
      ) : query.isError ? (
        <LoadError onRetry={() => void query.refetch()} />
      ) : (
        <Table
          label={label}
          columns={columns}
          rows={query.data}
          rowKey={rowKey}
          {...(onOpen ? { onRowClick: onOpen } : {})}
          empty={<p className="m-0 px-3.5 py-4 text-13 text-tx-3">{empty}</p>}
        />
      )}
    </>
  );
}

/** The add and edit dialog every section shares: a title, the form, Cancel and Save. */
export function EditDialog({
  title,
  onClose,
  onSave,
  saving,
  error,
  children,
  width = 'md',
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: Error | null;
  children: ReactNode;
  width?: 'md' | 'lg';
}) {
  const t = useT(peopleText);
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      width={width}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('people.settings.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={onSave}>
            {t('people.settings.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        {error ? <p className="m-0 text-13 text-red-tx">{error.message}</p> : null}
        {children}
      </form>
    </Modal>
  );
}
