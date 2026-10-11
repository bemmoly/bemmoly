import { EmptyState, TableSkeleton } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { SettingsFailure } from '../../../components/settings/settings-states.tsx';
import { isForbidden } from '../../../hooks/use-webhooks.ts';

/** A failed load in plain words; a refusal says what access it takes instead of "Retry". */
export function WebhooksFailure({ error }: { error: unknown }) {
  if (isForbidden(error)) {
    return (
      <EmptyState
        icon={<Icon name="lock" />}
        title="You can't manage webhooks"
        description="Webhooks need “Manage workspace settings”. Ask a workspace admin for it."
      />
    );
  }
  return <SettingsFailure error={error} />;
}

/** A table while it loads, with the loaded tracks so nothing shifts when rows land. */
export function TableLoading({ label, widths }: { label: string; widths: readonly string[] }) {
  return <TableSkeleton label={label} rows={4} columns={widths.map((width) => ({ width }))} />;
}
