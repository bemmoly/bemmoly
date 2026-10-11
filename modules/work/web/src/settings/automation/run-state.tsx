import type { AutomationRunStatus } from '@bemmoly/module-work/shared';
import { Icon } from '@bemmoly/ui/icons';
import { cx } from '../cx.ts';
import { runLook } from './describe.ts';

/** A run's state: its drawn mark and its word, in the state's signal ink. */
export function RunState({
  status,
  className,
}: {
  status: AutomationRunStatus;
  className?: string;
}) {
  const look = runLook(status);
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-12 font-medium whitespace-nowrap',
        look.ink,
        className,
      )}
    >
      <Icon name={look.icon} size={14} />
      {look.label}
    </span>
  );
}
