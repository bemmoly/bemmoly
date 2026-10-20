import type { BacklogSortRule } from '@bemmoly/module-work/shared';
import type { LqlFieldCatalog } from '@bemmoly/shared';
import { Card, Select } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { cx } from '../cx.ts';
import { useDragList } from '../drag.ts';
import { LqlInput } from '../lql/lql-input.tsx';
import { sortRuleLabel } from '../model/labels.ts';

export interface SortRulesProps {
  rules: readonly BacklogSortRule[];
  editable: boolean;
  catalog: LqlFieldCatalog;
  values: Readonly<Record<string, readonly string[]>>;
  onChange: (rules: BacklogSortRule[]) => void;
}

/** Fields that order nothing useful on their own: free text and the many-valued label. */
const UNSORTABLE = new Set(['text', 'label']);

const KIND_OPTIONS = [
  { value: 'match', label: 'Put first' },
  { value: 'field', label: 'Sort by' },
];
const DIRECTION_OPTIONS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
];

const ruleOfKind = (kind: string, name: string): BacklogSortRule =>
  kind === 'field'
    ? { kind: 'field', field: 'priority', direction: 'desc' }
    : { kind: 'match', name, query: '' };

/**
 * The backlog's sort rules, in the Custom lanes card's shape: a header with the add action, then
 * one row per rule in the order they apply, each with grip, kind, what it sorts by and remove.
 */
export function SortRules({ rules, editable, catalog, values, onChange }: SortRulesProps) {
  const drag = useDragList({
    disabled: !editable,
    onMove: (from, to) => {
      const next = [...rules];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      onChange(next);
    },
  });
  const set = (index: number, rule: BacklogSortRule) =>
    onChange(rules.map((item, at) => (at === index ? rule : item)));
  const fields = catalog.fields
    .filter((field) => !UNSORTABLE.has(field.key))
    .map((field) => ({ value: field.key, label: field.label }));
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center border-b border-line-2 px-4 py-3 font-semibold">
        Sort rules
        {editable && (
          <button
            type="button"
            onClick={() => onChange([...rules, ruleOfKind('match', `Rule ${rules.length + 1}`)])}
            className="ml-auto inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-sans text-13 font-medium text-acc hover:text-acc-600"
          >
            <Icon name="plus" size={14} />
            Add sort rule
          </button>
        )}
      </div>
      <div className="flex flex-col px-4 py-1.5">
        {rules.map((rule, index) => (
          <div
            key={index}
            {...drag.item(index)}
            className={cx(
              'flex items-start gap-2.5 border-b border-line-2 py-2.5 max-sm:flex-wrap',
              drag.over === index && 'shadow-tab',
            )}
          >
            <span
              {...drag.handle(index, rules.length)}
              {...(editable
                ? { tabIndex: 0, role: 'button', 'aria-label': `Move ${sortRuleLabel(rule)}` }
                : {})}
              className={cx('flex pt-1.5 text-tx-3', editable && 'cursor-grab')}
            >
              <Icon name="drag" size={14} />
            </span>
            <Select
              aria-label="Rule kind"
              options={KIND_OPTIONS}
              value={rule.kind}
              disabled={!editable}
              onChange={(event) =>
                event.value !== rule.kind &&
                set(index, ruleOfKind(event.value, `Rule ${index + 1}`))
              }
            />
            {rule.kind === 'match' ? (
              <>
                <input
                  aria-label="Sort rule name"
                  value={rule.name}
                  readOnly={!editable}
                  onChange={(event) => set(index, { ...rule, name: event.target.value })}
                  className="w-36 shrink-0 rounded-chip border border-line bg-card px-2 py-1.25 font-sans text-13 font-medium text-tx outline-0 focus:border-acc"
                />
                <LqlInput
                  aria-label={`${rule.name} query`}
                  className="flex-1"
                  value={rule.query}
                  readOnly={!editable}
                  catalog={catalog}
                  values={values}
                  placeholder='type = "Support request"'
                  onChange={(query) => set(index, { ...rule, query })}
                />
              </>
            ) : (
              <>
                <Select
                  aria-label="Sort field"
                  searchable
                  options={fields}
                  value={rule.field}
                  disabled={!editable}
                  onChange={(event) => set(index, { ...rule, field: event.value })}
                />
                <Select
                  aria-label="Sort direction"
                  options={DIRECTION_OPTIONS}
                  value={rule.direction}
                  disabled={!editable}
                  onChange={(event) =>
                    set(index, { ...rule, direction: event.value === 'desc' ? 'desc' : 'asc' })
                  }
                />
              </>
            )}
            {editable && (
              <button
                type="button"
                aria-label={`Remove ${sortRuleLabel(rule)}`}
                onClick={() => onChange(rules.filter((_, at) => at !== index))}
                className="ml-auto flex cursor-pointer border-0 bg-transparent pt-1.5 text-tx-3 hover:text-tx-2"
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        ))}
        <div className="py-2.5 text-12 text-tx-3">
          {rules.length === 0
            ? 'No sort rules: the backlog keeps the order you rank it in.'
            : 'Rules apply top to bottom; rank orders whatever they leave tied. Dragging to rank is off while rules sort the backlog.'}
        </div>
      </div>
    </Card>
  );
}
