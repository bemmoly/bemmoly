import type { ImportContainerRow } from '@bemmoly/shared';
import { Input, KeyChip, SegmentedControl, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useId } from 'react';
import type { ImportOptions } from '../../hooks/use-import-options.ts';
import { StatePill } from '../settings/state-pill.tsx';
import { count, shortDate, type ImportNouns } from './import-words.ts';

/** The two-sided mapping row: what it is at the source, an arrow, where it goes here. */
export const MAP_ROW =
  'grid grid-cols-[minmax(0,1.1fr)_18px_minmax(0,1.6fr)] items-center gap-2.5 border-b border-line-2 py-2.5 last:border-b-0 max-sm:grid-cols-1 max-sm:gap-1.5';

/** "6,220 issues · service project", "1,840 issues · imported Oct 2". */
function detailOf(row: ImportContainerRow, nouns: ImportNouns) {
  const parts = [`${count(row.count ?? 0)} ${nouns.records}`];
  if (row.imported) parts.push(`imported ${shortDate(row.imported.at)}`);
  if (row.type === 'Service') parts.push(`service ${nouns.container}`);
  if (row.type === 'Personal') parts.push('personal');
  return parts.join(' · ');
}

/** One chosen project or space and where it goes: updated, new with a key, or existing. */
export function TargetRow({ row, options }: { row: ImportContainerRow; options: ImportOptions }) {
  const { targets, nouns, holders } = options;
  const whyId = useId();
  const mode = targets.modeOf(row);
  const error = targets.errorOf(row);
  const note = mode === row.target?.mode ? row.target.note : null;
  const why = error ?? note;
  const target = row.target;
  return (
    <li className={MAP_ROW}>
      <div className="min-w-0">
        <span className="flex min-w-0 items-baseline gap-1.5">
          {row.key ? <KeyChip issueKey={row.key} size="md" /> : null}
          <span className="truncate text-13 font-medium text-tx">{row.name}</span>
        </span>
        <span className="block text-12 text-tx-3">{detailOf(row, nouns)}</span>
      </div>
      <span aria-hidden className="text-tx-3 max-sm:hidden">
        <Icon name="arrow" size={14} />
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {mode === 'update' && target ? (
          <StatePill tone="neutral" icon="refresh">
            Updates {target.name} ({target.key})
          </StatePill>
        ) : (
          <>
            <SegmentedControl
              size="sm"
              aria-label={`Where ${row.name} goes`}
              value={mode === 'existing' ? 'existing' : 'create'}
              onChange={(next) => targets.setMode(row, next)}
              options={[
                { value: 'create', label: `New ${nouns.container}` },
                { value: 'existing', label: 'Existing' },
              ]}
            />
            {mode === 'existing' ? (
              <Select
                size="sm"
                searchable
                aria-label={`${nouns.target} for ${row.name}`}
                aria-describedby={why ? whyId : undefined}
                placeholder={holders.loading ? 'Loading…' : `Choose a ${nouns.target}`}
                options={holders.options}
                value={target?.mode === 'existing' ? (target.id ?? '') : ''}
                onChange={(event) => targets.pick(row, event.value)}
                error={Boolean(error)}
              />
            ) : (
              <Input
                mono
                aria-label={`Key for ${row.name}`}
                aria-invalid={error ? true : undefined}
                aria-describedby={why ? whyId : undefined}
                value={targets.keyOf(row)}
                onChange={(event) => targets.setKey(row, event.target.value)}
                spellCheck={false}
                autoComplete="off"
                maxLength={10}
                wrapperClassName="w-24"
              />
            )}
          </>
        )}
        {why ? (
          <span id={whyId} className={`basis-full text-12 ${error ? 'text-red-tx' : 'text-tx-3'}`}>
            {why}
          </span>
        ) : null}
      </div>
    </li>
  );
}
