import type { HTMLAttributes, ReactNode } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { cx } from '../../lib/cx.ts';
import { Badge } from '../badge/badge.tsx';
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
    <span aria-hidden className="text-danger">
      {' '}
      *
    </span>
  );
}

/** The field badges of the type settings: SYSTEM (chip), AI-FILLED and PROJECT (accent). */
export type FieldTag = 'system' | 'ai-filled' | 'project';

const FIELD_TAGS: Record<FieldTag, { label: string; tone: 'neutral' | 'accent' }> = {
  system: { label: 'SYSTEM', tone: 'neutral' },
  'ai-filled': { label: 'AI-FILLED', tone: 'accent' },
  project: { label: 'PROJECT', tone: 'accent' },
};

export interface FieldLayoutRowProps {
  name: ReactNode;
  /** The field type in mono: "text", "rich text", "select". */
  type: ReactNode;
  tag?: FieldTag;
  /** "Suggests from similar past issues", under the name in 11.5px tx5. */
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
 * One field of an issue type's create form layout: 9px 14px rows over a br-row rule, the
 * name in medium with its tag, the type in 12px mono tx3 and two switches.
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
        'grid items-center gap-2.5 border-b border-br-row px-3.5 py-2.25 text-13 text-tx',
        className,
      )}
    >
      <span aria-hidden className="cursor-grab text-tx6" {...dragHandleProps}>
        <Icon name="drag" size={14} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="flex items-center gap-1.5 font-medium">
          {name}
          {tag && (
            <Badge tone={FIELD_TAGS[tag].tone} className="px-1.5 py-px text-10h">
              {FIELD_TAGS[tag].label}
            </Badge>
          )}
        </span>
        {help && <span className="text-11h text-tx5">{help}</span>}
      </span>
      <span className="font-mono text-12 text-tx3">{type}</span>
      <Switch
        aria-label={`${label} required`}
        checked={required}
        disabled={requiredLocked}
        onCheckedChange={onRequiredChange}
      />
      <Switch aria-label={`${label} on card`} checked={onCard} onCheckedChange={onCardChange} />
      <span className="flex justify-center text-tx6">
        {onMore && (
          <button
            type="button"
            aria-label={`${label} actions`}
            onClick={onMore}
            className="flex cursor-pointer border-0 bg-transparent p-0 text-tx6 hover:text-tx2"
          >
            <Icon name="more" size={14} />
          </button>
        )}
      </span>
    </div>
  );
}

/** The header of the fields table: 11px tracked capitals on sf2. */
export function FieldLayoutHeader({ className }: { className?: string }) {
  return (
    <div
      style={{ gridTemplateColumns: FIELD_LAYOUT_TEMPLATE }}
      className={cx(
        'grid gap-2.5 border-b border-br2 bg-sf2 px-3.5 py-2.25 text-11 font-medium tracking-caps text-tx5 uppercase',
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
