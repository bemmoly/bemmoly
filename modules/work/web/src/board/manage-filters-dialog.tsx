import { isApiError } from '@bemmoly/api-client';
import { Button, Input, Modal, useToast } from '@bemmoly/ui';
import { useState } from 'react';
import type { SavedFilter } from '../../../shared/index.ts';
import type { SavedFilters } from '../hooks/saved-filters.ts';

export interface ManageFiltersDialogProps {
  open: boolean;
  filters: SavedFilters;
  onClose: () => void;
}

const failure = (error: unknown) =>
  error ? (isApiError(error) ? error.message : 'That did not work. Try again.') : null;

/** One of my filters: its name, who sees it and its query, renamed in place. */
function FilterRow({
  filter,
  filters,
  onDelete,
}: {
  filter: SavedFilter;
  filters: SavedFilters;
  onDelete: () => void;
}) {
  const [name, setName] = useState<string | null>(null);
  const save = () => {
    if (name === null || !name.trim()) return;
    filters.rename.mutate({ id: filter.id, name }, { onSuccess: () => setName(null) });
  };
  return (
    <li className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0">
      {name === null ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-13 font-medium text-tx">{filter.name}</span>
          <Button size="sm" variant="ghost" onClick={() => setName(filter.name)}>
            Rename
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            Delete
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            autoFocus
            aria-label={`New name for ${filter.name}`}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                event.preventDefault();
                setName(null);
              }
            }}
            wrapperClassName="flex-1"
          />
          <Button size="sm" variant="ghost" onClick={() => setName(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            type="submit"
            disabled={!name.trim()}
            loading={filters.rename.isPending}
          >
            Save
          </Button>
        </form>
      )}
      <span className="text-12 text-tx-3">{filters.audience(filter)}</span>
      <code className="truncate font-mono text-12 text-tx-2">{filter.query}</code>
    </li>
  );
}

/**
 * Rename and delete the filters I saved; others' shared filters are theirs to change. Delete
 * happens at once and the toast offers Undo, which saves the filter again as it was.
 */
export function ManageFiltersDialog({ open, filters, onClose }: ManageFiltersDialogProps) {
  const toast = useToast();
  const error = failure(filters.rename.error) ?? failure(filters.remove.error);
  const remove = (filter: SavedFilter) =>
    filters.remove.mutate(filter.id, {
      onSuccess: () =>
        toast.show({
          tone: 'ok',
          title: `Deleted "${filter.name}"`,
          action: {
            label: 'Undo',
            onClick: () =>
              filters.save.mutate({
                name: filter.name,
                query: filter.query,
                teamId: filter.sharedWith[0] ?? null,
              }),
          },
        }),
    });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="My saved filters"
      description="Rename a filter in place. Deleting one can be undone for a few seconds."
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {filters.mine.length === 0 ? (
        <p className="m-0 text-13 text-tx-3">You have no saved filters on this project.</p>
      ) : (
        <ul aria-label="My saved filters" className="m-0 flex list-none flex-col p-0">
          {filters.mine.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              filters={filters}
              onDelete={() => remove(filter)}
            />
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="m-0 mt-2 text-12 text-red-tx">
          {error}
        </p>
      )}
    </Modal>
  );
}
