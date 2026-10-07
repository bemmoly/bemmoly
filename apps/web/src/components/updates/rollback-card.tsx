import { formatDateTime, formatRelative } from '@bemmoly/core-web';
import type { RollbackPlan, UpdatesOverview } from '@bemmoly/shared';
import { Button, SettingsRow, SettingsSection } from '@bemmoly/ui';
import { rollbackCopy } from '../../hooks/use-updates-copy.ts';
import { CommandBlock } from './release-card.tsx';

interface RollbackCardProps {
  overview: UpdatesOverview;
  plan: RollbackPlan;
  busy: boolean;
  onRollback: () => void;
}

export function RollbackCard({ overview, plan, busy, onRollback }: RollbackCardProps) {
  const copy = rollbackCopy(plan);
  const { current, updater } = overview;
  const updated = current.updatedAt ? ` ${formatRelative(current.updatedAt)}` : '';
  return (
    <SettingsSection
      title="Roll back"
      {...(plan.expiresAt ? { hint: `available until ${formatDateTime(plan.expiresAt)}` } : {})}
      layout="rows"
    >
      <SettingsRow
        title={`Updated to ${plan.fromVersion}${updated}`}
        description={`${copy.mode}: ${copy.summary}`}
        control={
          updater.mode === 'in_app' ? (
            <Button disabled={busy || updater.state === 'unreachable'} onClick={onRollback}>
              Roll back to {plan.toVersion}
            </Button>
          ) : null
        }
      />
      {updater.mode === 'in_app' ? null : (
        <div className="flex flex-col gap-2 py-2.5">
          <p className="m-0 text-12h leading-body text-tx4">
            Run this on the server. It prints the same mode and what it loses, then asks you to
            confirm.
          </p>
          <CommandBlock command="sudo bemmoly rollback" />
        </div>
      )}
    </SettingsSection>
  );
}
