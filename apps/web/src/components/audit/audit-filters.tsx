import type { User } from '@bemmoly/shared';
import { Button, Input, SearchInput, Select } from '@bemmoly/ui';
import type { AuditFilters } from '../../hooks/use-audit.ts';
import { userOption, useUserSearch } from '../../hooks/use-user-search.ts';

interface AuditFiltersBarProps {
  filters: AuditFilters;
  people: readonly User[];
  targetKinds: readonly string[];
  filtered: boolean;
  onChange: (patch: Partial<AuditFilters>) => void;
  onClear: () => void;
}

export function AuditFiltersBar({
  filters,
  people,
  targetKinds,
  filtered,
  onChange,
  onClear,
}: AuditFiltersBarProps) {
  const searchPeople = useUserSearch();
  return (
    <div
      role="search"
      aria-label="Filter the audit log"
      className="flex flex-wrap items-center gap-2"
    >
      <SearchInput
        aria-label="Action starts with"
        placeholder="Action, e.g. user. or backup.restored"
        mono
        wrapperClassName="w-72"
        value={filters.action}
        onChange={(event) => onChange({ action: event.target.value })}
      />
      <Select
        aria-label="Actor"
        wrapperClassName="w-44"
        searchable
        searchPlaceholder="Search people"
        loadOptions={searchPeople}
        options={[{ value: '', label: 'Anyone' }, ...people.map(userOption)]}
        value={filters.actorId}
        onChange={(event) => onChange({ actorId: event.target.value })}
      />
      <Select
        aria-label="Target kind"
        wrapperClassName="w-40"
        options={[
          { value: '', label: 'Any target' },
          ...targetKinds.map((kind) => ({ value: kind, label: kind })),
        ]}
        value={filters.targetKind}
        onChange={(event) => onChange({ targetKind: event.target.value })}
      />
      <Input
        type="date"
        aria-label="Since"
        wrapperClassName="w-38"
        max={filters.until || undefined}
        value={filters.since}
        onChange={(event) => onChange({ since: event.target.value })}
      />
      <span className="text-13 text-tx-3">to</span>
      <Input
        type="date"
        aria-label="Until"
        wrapperClassName="w-38"
        min={filters.since || undefined}
        value={filters.until}
        onChange={(event) => onChange({ until: event.target.value })}
      />
      {filtered ? (
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </div>
  );
}
