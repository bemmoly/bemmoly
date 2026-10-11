import { Button, Dropdown, MenuGroup, MenuItem, MenuSeparator, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import type { SavedFilter } from '../../../shared/index.ts';
import type { SavedFilters } from '../hooks/saved-filters.ts';
import { ManageFiltersDialog } from './manage-filters-dialog.tsx';
import { SaveFilterDialog } from './save-filter-dialog.tsx';

export interface SavedFiltersMenuProps {
  filters: SavedFilters;
  /** The LQL the board has applied now; empty when none. */
  applied: string;
  onApply(query: string): void;
}

/**
 * Beside the LQL bar: "Save filter" for the applied query, and the saved
 * filters menu listing mine and those shared with my teams, one click to
 * apply, with rename and delete for my own.
 */
export function SavedFiltersMenu({ filters, applied, onApply }: SavedFiltersMenuProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);
  const alreadySaved = [...filters.mine, ...filters.shared].some((f) => f.query === applied);
  const none = filters.mine.length === 0 && filters.shared.length === 0;

  const item = (filter: SavedFilter) => (
    <MenuItem
      key={filter.id}
      onSelect={() => onApply(filter.query)}
      icon={
        <Icon
          name="check"
          size={14}
          className={filter.query === applied ? 'text-acc' : 'invisible'}
        />
      }
      hint={filter.sharedWith.length > 0 && filters.mine.includes(filter) ? 'Shared' : undefined}
    >
      {filter.name}
    </MenuItem>
  );

  return (
    <>
      {applied && !alreadySaved && (
        <Button tight onClick={() => setSaving(true)}>
          Save filter
        </Button>
      )}
      <Dropdown label="Saved filters">
        {none ? (
          <NoSavedFilters />
        ) : (
          <MenuGroup label="Mine">
            {filters.mine.length > 0 ? (
              filters.mine.map(item)
            ) : (
              <MenuItem disabled onSelect={() => undefined}>
                None of your own yet
              </MenuItem>
            )}
          </MenuGroup>
        )}
        {filters.shared.length > 0 && (
          <MenuGroup label="Shared with me" separated>
            {filters.shared.map(item)}
          </MenuGroup>
        )}
        <MenuSeparator />
        <MenuItem
          disabled={!applied}
          hint={applied ? undefined : 'Apply an LQL query first'}
          onSelect={() => setSaving(true)}
        >
          Save current filter…
        </MenuItem>
        {filters.mine.length > 0 && (
          <MenuItem onSelect={() => setManaging(true)}>Rename or delete…</MenuItem>
        )}
      </Dropdown>
      <SaveFilterDialog
        key={saving ? 'open' : 'closed'}
        open={saving}
        query={applied}
        teams={filters.myTeams}
        busy={filters.save.isPending}
        error={filters.save.error}
        onClose={() => {
          filters.save.reset();
          setSaving(false);
        }}
        onSave={(input) =>
          filters.save.mutate(input, {
            onSuccess: (saved) => {
              setSaving(false);
              toast.show({ tone: 'ok', title: `Saved "${saved.name}"` });
            },
          })
        }
      />
      <ManageFiltersDialog open={managing} filters={filters} onClose={() => setManaging(false)} />
    </>
  );
}

/**
 * The menu with nothing saved: what saved filters are, above the one action that makes one
 * ("Save current filter…" under the rule). Read out as part of the menu, not as an item.
 */
function NoSavedFilters() {
  return (
    <div
      role="none"
      className="flex max-w-64 flex-col items-center gap-1 px-3 pt-3 pb-2.5 text-center"
    >
      <span
        aria-hidden
        className="mb-1 flex size-7 items-center justify-center rounded-control bg-line-2 text-tx-3"
      >
        <Icon name="filter" size={14} />
      </span>
      <span className="text-13 font-semibold text-tx">No saved filters yet</span>
      <span className="text-12 leading-body text-tx-3">
        Apply an LQL query, then save it to come back to it in one click.
      </span>
    </div>
  );
}
