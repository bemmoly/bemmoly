import { isApiError } from '@bemmoly/api-client';
import { Button, ConfirmChange, Input, Modal } from '@bemmoly/ui';
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
    <li className="flex flex-col gap-1.5 border-b border-br-row py-2.5 last:border-b-0">
      {name === null ? (
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-13 font-medium text-tx">{filter.name}</span>
          <Button size="sm" onClick={() => setName(filter.name)}>
            Rename
          </Button>
          <Button size="sm" onClick={onDelete}>
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
            wrapperClassName="flex-1"
          />
          <Button size="sm" onClick={() => setName(null)}>
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
      <span className="text-12 text-tx5">{filters.audience(filter)}</span>
      <code className="truncate font-mono text-12 text-tx3">{filter.query}</code>
    </li>
  );
}

/** Rename and delete the filters I saved; others' shared filters are theirs to change. */
export function ManageFiltersDialog({ open, filters, onClose }: ManageFiltersDialogProps) {
  const [deleting, setDeleting] = useState<SavedFilter | null>(null);
  const error = failure(filters.rename.error);
  return (
    <>
      <Modal
        open={open && deleting === null}
        onClose={onClose}
        title="My saved filters"
        footer={<Button onClick={onClose}>Done</Button>}
      >
        {filters.mine.length === 0 ? (
          <p className="m-0 text-13 text-tx4">You have no saved filters on this project.</p>
        ) : (
          <ul aria-label="My saved filters" className="m-0 flex list-none flex-col p-0">
            {filters.mine.map((filter) => (
              <FilterRow
                key={filter.id}
                filter={filter}
                filters={filters}
                onDelete={() => setDeleting(filter)}
              />
            ))}
          </ul>
        )}
        {error && (
          <p role="alert" className="m-0 mt-2 text-12 text-danger">
            {error}
          </p>
        )}
      </Modal>
      <ConfirmChange
        open={deleting !== null}
        title={`Delete "${deleting?.name ?? ''}"?`}
        consequences={[
          deleting?.sharedWith.length
            ? 'It goes for you and for everyone in the team it is shared with.'
            : 'It goes from your saved filters.',
          'The board keeps its current filter.',
        ]}
        confirmLabel="Delete filter"
        busy={filters.remove.isPending}
        error={failure(filters.remove.error)}
        onConfirm={() => {
          if (deleting) filters.remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
        onCancel={() => {
          filters.remove.reset();
          setDeleting(null);
        }}
      />
    </>
  );
}
