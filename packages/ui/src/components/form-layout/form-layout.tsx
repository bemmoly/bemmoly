import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Switch } from '../switch/switch.tsx';

export interface FormGridProps extends HTMLAttributes<HTMLDivElement> {
  /** Columns of the create form; the Board Settings sprint form uses three, 14px apart. */
  columns?: 1 | 2 | 3;
}

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

/** Fields laid out on a grid 14px apart; a field spans the row with FormGridItem full. */
export function FormGrid({ columns = 2, className, ...rest }: FormGridProps) {
  return <div className={cx('grid gap-3.5', COLUMNS[columns], className)} {...rest} />;
}

export interface FormGridItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Takes the whole row: title, description, acceptance criteria. */
  full?: boolean;
}

export function FormGridItem({ full, className, ...rest }: FormGridItemProps) {
  return <div className={cx('min-w-0', full && 'col-span-full', className)} {...rest} />;
}

/** The red asterisk after a required field's label. */
export function RequiredMark() {
  return (
    <span aria-hidden className="text-red">
      {' '}
      *
    </span>
  );
}

/** The field badges of the type settings: System (chip), AI-filled and Project (accent). */
export type FieldTag = 'system' | 'ai-filled' | 'project';

const FIELD_TAGS: Record<FieldTag, { label: string; className: string }> = {
  system: { label: 'System', className: 'bg-sunken text-tx-2 ring-1 ring-line ring-inset' },
  'ai-filled': { label: 'AI-filled', className: 'bg-acc-50 text-acc' },
  project: { label: 'Project', className: 'bg-acc-50 text-acc' },
};

export interface FieldLayoutRowProps {
  name: ReactNode;
  /** The field type in mono: "text", "rich text", "select". */
  type: ReactNode;
  tag?: FieldTag;
  /** "Suggests from similar past issues", under the name in 12px tx-3. */
  help?: ReactNode;
  required: boolean;
  onRequiredChange?: (required: boolean) => void;
  /** System fields cannot change their required flag. */
  requiredLocked?: boolean;
  onCard: boolean;
  onCardChange?: (onCard: boolean) => void;
  onMore?: () => void;
  dragHandleProps?: Record<string, unknown>;
  className?: string;
}

/** The six tracks of the fields table: grip, field, type, required, on card, more. */
export const FIELD_LAYOUT_TEMPLATE = '16px minmax(0,1fr) 110px 90px 90px 28px';

/**
 * One field of an issue type's create form layout: 44px rows over the light line, the name in
 * medium with its tag, the type in 12px mono tx-3 and two switches.
 */
export function FieldLayoutRow({
  name,
  type,
  tag,
  help,
  required,
  onRequiredChange,
  requiredLocked = false,
  onCard,
  onCardChange,
  onMore,
  dragHandleProps,
  className,
}: FieldLayoutRowProps) {
  const label = typeof name === 'string' ? name : 'field';
  return (
    <div
      style={{ gridTemplateColumns: FIELD_LAYOUT_TEMPLATE }}
      className={cx(
        'group/row grid min-h-11 items-center gap-2.5 border-b border-line-2 px-3 py-1.5 text-13 text-tx hover:bg-hover',
        className,
      )}
    >
      <span aria-hidden className="cursor-grab text-tx-3" {...dragHandleProps}>
        <Icon name="drag" size={14} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="flex items-center gap-1.5 font-medium">
          {name}
          {tag && (
            <span
              className={cx(
                'inline-flex h-4.5 items-center rounded-chip px-1.5 text-11 font-medium',
                FIELD_TAGS[tag].className,
              )}
            >
              {FIELD_TAGS[tag].label}
            </span>
          )}
        </span>
        {help && <span className="text-12 text-tx-3">{help}</span>}
      </span>
      <span className="font-mono text-12 text-tx-3">{type}</span>
      <Switch
        aria-label={`${label} required`}
        checked={required}
        disabled={requiredLocked}
        onCheckedChange={onRequiredChange}
      />
      <Switch aria-label={`${label} on card`} checked={onCard} onCheckedChange={onCardChange} />
      <span className="flex justify-center text-tx-3">
        {onMore && (
          <button
            type="button"
            aria-label={`${label} actions`}
            onClick={onMore}
            className="flex cursor-pointer rounded-chip border-0 bg-transparent p-0.5 text-tx-3 hover:text-tx focus-ring"
          >
            <Icon name="more" size={14} />
          </button>
        )}
      </span>
    </div>
  );
}

/** The header of the fields table: the one table's sentence-case headings over a line. */
export function FieldLayoutHeader({ className }: { className?: string }) {
  return (
    <div
      style={{ gridTemplateColumns: FIELD_LAYOUT_TEMPLATE }}
      className={cx(
        'grid h-8.5 items-center gap-2.5 border-b border-line px-3 text-12 font-medium text-tx-3',
        className,
      )}
    >
      <span />
      <span>Field</span>
      <span>Type</span>
      <span>Required</span>
      <span>On card</span>
      <span />
    </div>
  );
}
