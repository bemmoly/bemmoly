import { useT } from '@bemmoly/core-web';
import { START_OVER_PHRASE } from '@bemmoly/module-pipelines/shared';
import { Button, Card, CardBody, CardHeader, Field, Input, Modal, useToast } from '@bemmoly/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useStartOver } from '../../../hooks/use-setup.ts';
import { setupText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';

/**
 * Platform › Settings: Start over. Everything Pipelines recorded goes behind a typed
 * confirmation, and the person lands on the setup checklist of a fresh install.
 */
export default function PlatformSettingsScreen() {
  const t = useT(setupText);
  const toast = useToast();
  const navigate = useNavigate();
  const startOver = useStartOver();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const close = () => {
    setOpen(false);
    setTyped('');
  };
  const confirm = () =>
    startOver.mutate(
      { confirm: START_OVER_PHRASE },
      {
        onSuccess: (result) => {
          close();
          toast.show({
            tone: 'ok',
            title: t('pipelinesSetup.startOver.done', { count: result.removed }),
          });
          void navigate({ to: '/' });
        },
      },
    );
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      <Card>
        <CardHeader
          title={<h2 className="text-15 font-semibold">{t('pipelinesSetup.startOver.title')}</h2>}
        />
        <CardBody className="flex flex-col items-start gap-3">
          <p className="max-w-[72ch] text-13 text-tx-2">{t('pipelinesSetup.startOver.text')}</p>
          <Button variant="danger" onClick={() => setOpen(true)}>
            {t('pipelinesSetup.startOver.button')}
          </Button>
        </CardBody>
      </Card>
      {open && (
        <Modal
          open
          width="sm"
          onClose={close}
          title={t('pipelinesSetup.startOver.dialogTitle')}
          description={t('pipelinesSetup.startOver.dialogText')}
          footer={
            <>
              <Button variant="ghost" onClick={close}>
                {t('pipelinesSetup.startOver.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={typed.trim().toLowerCase() !== START_OVER_PHRASE}
                loading={startOver.isPending}
                onClick={confirm}
              >
                {t('pipelinesSetup.startOver.confirm')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label={t('pipelinesSetup.startOver.typeLabel', { phrase: START_OVER_PHRASE })}>
              <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
            </Field>
            <ActionError error={startOver.error} />
          </div>
        </Modal>
      )}
    </div>
  );
}
