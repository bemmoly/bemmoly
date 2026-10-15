import type { ImportPersonRow } from '@bemmoly/shared';
import { Button, SettingsSection, Select, Skeleton, type SelectOption } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId } from 'react';
import type { ImportOptions } from '../../hooks/use-import-options.ts';
import { personValue } from '../../hooks/use-import-people.ts';
import { FormError } from '../form.tsx';
import { StatePill } from '../settings/state-pill.tsx';
import { DisclosureButton } from './disclosure-button.tsx';
import { count } from './import-words.ts';
import { MAP_ROW } from './target-row.tsx';

const PLACEHOLDER: SelectOption = { value: 'placeholder', label: 'Placeholder' };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-control bg-sunken px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--line)]">
      <dt className="text-12 text-tx-3">{label}</dt>
      <dd className="m-0 text-16 font-semibold text-tx tabular-nums">{count(value)}</dd>
    </div>
  );
}

function PersonRow({ row, options }: { row: ImportPersonRow; options: ImportOptions }) {
  const { people } = options;
  const current: SelectOption[] =
    row.userId && row.userName ? [{ value: row.userId, label: row.userName }] : [];
  const hint = row.match === 'hidden' ? 'Pick a member if you know who this is.' : null;
  return (
    <li className={MAP_ROW}>
      <div className="min-w-0">
        <span className="block truncate text-13 font-medium text-tx">{row.name}</span>
        <span className="block truncate text-12 text-tx-3">{row.email ?? 'Email hidden'}</span>
      </div>
      <span aria-hidden className="text-tx-3 max-sm:hidden">
        <Icon name="arrow" size={14} />
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Select
          size="sm"
          aria-label={`Who ${row.name} becomes`}
          options={[PLACEHOLDER, ...current]}
          loadOptions={people.search}
          searchPlaceholder="Search members"
          value={personValue(row)}
          onChange={(event) =>
            people.choose(row, event.value === 'placeholder' ? 'placeholder' : event.value)
          }
        />
        {row.match === 'matched' ? (
          <StatePill tone="ok">{row.override ? 'Chosen' : 'Matched'}</StatePill>
        ) : null}
        {hint ? <span className="basis-full text-12 text-tx-3">{hint}</span> : null}
      </div>
    </li>
  );
}

/**
 * People: how many match a member by email, become placeholders, or have their email hidden;
 * the first few who may need a hand, and "Review all" for everyone, a page at a time.
 */
export function OptionsPeople({ options }: { options: ImportOptions }) {
  const { people, nouns, label } = options;
  const listId = useId();
  const summary = people.summary;
  if (!summary || summary.total === 0) return null;
  return (
    <SettingsSection
      title="People"
      hint={`${count(summary.total)} found across the chosen ${nouns.containers}`}
    >
      <dl className="m-0 grid grid-cols-3 gap-3 max-sm:grid-cols-2">
        <Stat label="Match a member by email" value={summary.matched} />
        <Stat label="Become placeholders" value={summary.placeholders} />
        <Stat label={`Email hidden by ${label}`} value={summary.hidden} />
      </dl>
      <p className="m-0 text-12 text-tx-2">
        A placeholder keeps the person's name on what they wrote. When they join with the same
        email, everything moves to their account.
      </p>
      <FormError error={people.error} />
      {people.loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <ul id={listId} aria-label="People" className="m-0 flex list-none flex-col p-0">
          {people.rows.map((row) => (
            <PersonRow key={row.sourceId} row={row} options={options} />
          ))}
        </ul>
      )}
      {people.hasMore ? (
        <Button size="sm" variant="ghost" loading={people.loadingMore} onClick={people.loadMore}>
          Show more people
        </Button>
      ) : null}
      {summary.total > people.rows.length || people.expanded ? (
        <DisclosureButton expanded={people.expanded} controls={listId} onToggle={people.toggle}>
          {people.expanded ? 'Show fewer people' : `Review all ${count(summary.total)} people`}
        </DisclosureButton>
      ) : null}
    </SettingsSection>
  );
}
