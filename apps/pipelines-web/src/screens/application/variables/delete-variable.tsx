import { useT } from '@bemmoly/core-web';
import { ConfirmChange } from '@bemmoly/ui';
import { useVariableWrites } from '../../../hooks/use-variables.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import type { VariableRow } from './rows.ts';

/**
 * Delete asks first: a secret's value cannot come back from here. Services keep what they run
 * with until their next deploy, and a secret stays in the store for revisions that read it.
 */
export function DeleteVariable({
  application,
  row,
  environmentName,
  onClose,
}: {
  application: string;
  row: VariableRow | null;
  environmentName: string | null;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { remove } = useVariableWrites(application);
  const close = () => {
    remove.reset();
    onClose();
  };
  const name = row?.name ?? '';
  const where = environmentName ?? t('pipelines.variables.every');
  return (
    <ConfirmChange
      open={row !== null}
      title={t('pipelines.variables.deleteTitle', { name, environment: where })}
      consequences={[
        t('pipelines.variables.deleteNextDeploy'),
        ...(row?.variable.kind === 'secret' ? [t('pipelines.variables.deleteStays')] : []),
        ...(row?.overrides ? [t('pipelines.variables.deleteFallsBack')] : []),
      ]}
      confirmLabel={t('pipelines.variables.delete')}
      tone="danger"
      busy={remove.isPending}
      error={<ActionError error={remove.error} />}
      onCancel={close}
      onConfirm={() =>
        row &&
        remove.mutate(
          { application, environment: row.variable.environment?.key ?? null, name: row.name },
          { onSuccess: close },
        )
      }
    />
  );
}
