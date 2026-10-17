import { useId, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { Checkbox } from '../checkbox/checkbox.tsx';

export interface FacetOption {
  value: string;
  label: string;
  /** How many items this value would leave, with every other filter applied. */
  count: number;
  /** A leading mark: a domain's tile, a team's avatar. */
  icon?: ReactNode;
}

export interface FacetGroup {
  key: string;
  /** "Domain", "Owner team": sentence case. */
  label: string;
  options: readonly FacetOption[];
  selected: readonly string[];
  /** Show this many options, then "Show all N"; chosen options always show. */
  limit?: number;
}

export interface FacetPanelProps {
  groups: readonly FacetGroup[];
  onToggle: (group: string, value: string) => void;
  /** Names the panel: "Filters". */
  ariaLabel: string;
  /** "Show all 54". */
  showAllLabel: (count: number) => string;
  showFewerLabel: string;
  /** Counts in the person's language: 1,140. */
  formatCount?: (count: number) => string;
  className?: string;
}

/**
 * The catalog's filters: one list of checkboxes per facet, each value with what it would
 * leave. Values that would leave nothing stay visible but quiet, so the shape of the data is
 * still readable; long facets (teams) show their top values and a "Show all".
 */
export function FacetPanel({
  groups,
  onToggle,
  ariaLabel,
  showAllLabel,
  showFewerLabel,
  formatCount = String,
  className,
}: FacetPanelProps) {
  return (
    <nav aria-label={ariaLabel} className={cx('flex flex-col gap-4', className)}>
      {groups.map((group) => (
        <FacetList
          key={group.key}
          group={group}
          onToggle={onToggle}
          showAllLabel={showAllLabel}
          showFewerLabel={showFewerLabel}
          formatCount={formatCount}
        />
      ))}
    </nav>
  );
}

function FacetList({
  group,
  onToggle,
  showAllLabel,
  showFewerLabel,
  formatCount,
}: {
  group: FacetGroup;
  onToggle: (group: string, value: string) => void;
  showAllLabel: (count: number) => string;
  showFewerLabel: string;
  formatCount: (count: number) => string;
}) {
  const heading = useId();
  const [open, setOpen] = useState(false);
  const limit = group.limit ?? Infinity;
  const long = group.options.length > limit;
  const shown =
    open || !long
      ? group.options
      : group.options.filter(
          (option, index) => index < limit || group.selected.includes(option.value),
        );
  return (
    <section aria-labelledby={heading} className="flex flex-col">
      <h3 id={heading} className="mb-1 text-11 font-semibold text-tx-3">
        {group.label}
      </h3>
      <ul className="flex flex-col">
        {shown.map((option) => {
          const checked = group.selected.includes(option.value);
          return (
            <li key={option.value}>
              <label
                className={cx(
                  'flex h-7 cursor-pointer items-center gap-2 rounded-control px-1 text-12 hover:bg-hover',
                  option.count === 0 && !checked ? 'text-tx-3' : 'text-tx',
                )}
              >
                <Checkbox checked={checked} onChange={() => onToggle(group.key, option.value)} />
                {option.icon}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                <span className="text-tx-3 tabular-nums">{formatCount(option.count)}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className={cx(
            'mt-0.5 self-start rounded-chip px-1 text-12 text-acc hover:text-acc-600',
            focusRing,
          )}
        >
          {open ? showFewerLabel : showAllLabel(group.options.length)}
        </button>
      )}
    </section>
  );
}
