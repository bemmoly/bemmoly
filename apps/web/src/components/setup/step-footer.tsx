import { Button } from '@bemmoly/ui';
import { TEXT_ACTION } from '../actions.ts';

/** What every step needs from the wizard to draw its bottom row. */
export interface StepNav {
  label: string;
  counter: string;
  canSkip: boolean;
  next: () => void;
}

interface StepFooterProps {
  nav: StepNav;
  /** Overrides the step's label, e.g. "Continue" when the admin already exists. */
  label?: string;
  onPrimary?: () => void;
  /** Submits this form id instead of calling onPrimary. */
  form?: string;
  disabled?: boolean;
  loading?: boolean;
}

/** The wizard's bottom row: the primary action, "Skip for now", and "Step N of 6". */
export function StepFooter({ nav, label, onPrimary, form, disabled, loading }: StepFooterProps) {
  return (
    <div className="flex items-center gap-2.5 pt-2">
      <Button
        variant="primary"
        size="lg"
        type={form ? 'submit' : 'button'}
        form={form}
        onClick={form ? undefined : onPrimary}
        disabled={disabled}
        loading={loading}
      >
        {label ?? nav.label}
      </Button>
      {nav.canSkip ? (
        <button type="button" className={TEXT_ACTION} onClick={nav.next}>
          Skip for now
        </button>
      ) : null}
      <span className="ml-auto text-12 text-tx5">{nav.counter}</span>
    </div>
  );
}
