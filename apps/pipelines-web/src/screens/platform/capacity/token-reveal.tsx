import { useT } from '@bemmoly/core-web';
import { Button, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';

/** A pool token, shown once: only its hash is kept, so it is copied now or rotated later. */
export function TokenReveal({ token }: { token: string }) {
  const t = useT(pipelinesText);
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-13 text-tx">{t('pipelines.capacity.tokenOnce')}</p>
      <div className="flex items-center gap-2 rounded-control bg-sunken p-2.5">
        <code className="min-w-0 flex-1 font-mono text-12 break-all text-tx">{token}</code>
        <Button
          size="xs"
          variant="secondary"
          onClick={() =>
            void navigator.clipboard
              .writeText(token)
              .then(() => toast.show({ tone: 'ok', title: t('pipelines.capacity.tokenCopied') }))
          }
        >
          <Icon name="copy" size={14} />
          {t('pipelines.capacity.copy')}
        </Button>
      </div>
      <p className="text-12 text-tx-3">{t('pipelines.capacity.tokenUse')}</p>
    </div>
  );
}
