import { useT } from '@bemmoly/core-web';
import type { RunnerPool } from '@bemmoly/module-pipelines/shared';
import { Button, Modal } from '@bemmoly/ui';
import { usePoolWrites } from '../../../hooks/use-capacity.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { refusalOf } from '../../../parts/load-failed.tsx';
import { TokenReveal } from './token-reveal.tsx';

/** A new token for a pool; runners using the old one stop registering, so it asks first. */
export function RotateToken({ pool, onClose }: { pool: RunnerPool | null; onClose: () => void }) {
  const t = useT(pipelinesText);
  const { rotate } = usePoolWrites();
  const close = () => {
    rotate.reset();
    onClose();
  };
  const token = rotate.data?.token;
  return (
    <Modal
      open={pool !== null}
      onClose={close}
      width="sm"
      title={t('pipelines.capacity.rotateTitle', { name: pool?.name ?? '' })}
      description={token ? undefined : t('pipelines.capacity.rotateDescription')}
      footer={
        token ? (
          <Button variant="primary" onClick={close}>
            {t('pipelines.capacity.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('pipelines.common.cancel')}
            </Button>
            <Button
              variant="danger"
              loading={rotate.isPending}
              onClick={() => pool && rotate.mutate(pool.key)}
            >
              {t('pipelines.capacity.rotateToken')}
            </Button>
          </>
        )
      }
    >
      {token ? (
        <TokenReveal token={token} />
      ) : rotate.error ? (
        <p role="alert" className="text-12 text-red-tx">
          {refusalOf(rotate.error)?.sentence ?? t('pipelines.common.loadFailed')}
        </p>
      ) : null}
    </Modal>
  );
}
