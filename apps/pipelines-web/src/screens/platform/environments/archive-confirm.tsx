import { useT } from '@bemmoly/core-web';
import type { Environment } from '@bemmoly/module-pipelines/shared';
import { ConfirmChange } from '@bemmoly/ui';
import { useEnvironmentWrites } from '../../../hooks/use-environments.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';

/**
 * Archive asks first: nothing here brings an environment back, and it leaves every path at
 * once. While promotions to it are open the server refuses, and the reason shows here.
 */
export function ArchiveConfirm({
  environment,
  onClose,
}: {
  environment: Environment | null;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { archive } = useEnvironmentWrites();
  const close = () => {
    archive.reset();
    onClose();
  };
  const name = environment?.name ?? '';
  return (
    <ConfirmChange
      open={environment !== null}
      title={t('pipelines.environments.archiveTitle', { name })}
      consequences={[
        t('pipelines.environments.archiveLeaves', { name }),
        t('pipelines.environments.archiveKeeps'),
      ]}
      confirmLabel={t('pipelines.environments.archiveConfirm')}
      busy={archive.isPending}
      error={<ActionError error={archive.error} />}
      onCancel={close}
      onConfirm={() => environment && archive.mutate(environment.key, { onSuccess: close })}
    />
  );
}
