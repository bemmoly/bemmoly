import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

/** The three rule kinds a transition carries, in the Workflow mock's colours. */
export type RuleKind = 'condition' | 'validator' | 'post';

export const RULE_KINDS: Record<RuleKind, { label: string; className: string }> = {
  condition: { label: 'CONDITION', className: 'bg-chip text-tx3' },
  validator: { label: 'VALIDATOR', className: 'bg-st-qa-bg text-st-qa-fg' },
  post: { label: 'POST', className: 'bg-ok-bg text-ok-fg' },
};

export interface RuleChipProps {
  kind: RuleKind;
  /**
   * How many rules of the kind a transition carries, for the chips on a canvas edge label:
   * the kind's initial and the count in 9px, 0 4px, so the label stays one line.
   */
  count?: number;
  className?: string;
}

/** The kind badge: 10.5px semibold, 1px 6px, 3px radius. */
export function RuleChip({ kind, count, className }: RuleChipProps) {
  const rule = RULE_KINDS[kind];
  if (count !== undefined) {
    const name = `${count} ${rule.label.toLowerCase()}${count === 1 ? '' : 's'}`;
    return (
      <span
        title={name}
        className={cx(
          'inline-flex shrink-0 rounded-chip px-1 text-9h font-semibold',
          rule.className,
          className,
        )}
      >
        <span aria-hidden>
          {rule.label[0]}
          {count}
        </span>
        <span className="sr-only">{name}</span>
      </span>
    );
  }
  return (
    <span
      className={cx(
        'inline-flex shrink-0 rounded-chip px-1.5 py-px text-10h font-semibold',
        rule.className,
        className,
      )}
    >
      {rule.label}
    </span>
  );
}

export interface RuleRowProps {
  kind: RuleKind;
  children: ReactNode;
  className?: string;
}

/** A rule in the side panel: the chip beside its sentence in a br-bordered 6px frame. */
export function RuleRow({ kind, children, className }: RuleRowProps) {
  return (
    <div
      className={cx(
        'flex items-start gap-2 rounded-control border border-br px-2.5 py-2 text-12h text-tx',
        className,
      )}
    >
      <RuleChip kind={kind} className="mt-px" />
      <span className="leading-note">{children}</span>
    </div>
  );
}
