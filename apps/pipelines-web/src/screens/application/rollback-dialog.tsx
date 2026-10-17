import { useT } from '@bemmoly/core-web';
import type { EnvironmentStripItem } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal, Select, useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type KeyboardEvent } from 'react';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { api } from '../../lib/api.ts';
import { ActionError } from '../../parts/action-error.tsx';

/** Environments that have something to go back to. */
export function rollbackable(items: readonly EnvironmentStripItem[]) {
  return items.filter((item) => item.deploymentId && item.previousVersion);
}

/**
 * Roll back…: one environment back to the release it ran before. It is a deployment like any
 * other, recorded and visible on the map, and never waits for a window or a freeze.
 */
export function RollbackDialog({
  application,
  items,
  initial,
  open,
  onClose,
}: {
  application: string;
  items: readonly EnvironmentStripItem[];
  initial: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const toast = useToast();
  const client = useQueryClient();
  const choices = rollbackable(items);
  const [picked, setPicked] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const preferred = choices.find((item) => item.environment.key === initial) ?? choices[0];
  const env = picked ?? preferred?.environment.key ?? '';
  const target = choices.find((item) => item.environment.key === env);
  const close = () => {
    setPicked(null);
    setReason('');
    onClose();
  };
  const rollback = useMutation({
    mutationFn: () =>
      api.shipping.rollback(
        target?.deploymentId ?? '',
        reason.trim() ? { reason: reason.trim() } : {},
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: pipelinesKeys.application(application) });
      toast.show({
        tone: 'ok',
        title: t('pipelines.rollback.started', {
          application,
          env: target?.environment.name ?? '',
          version: target?.previousVersion ?? '',
        }),
      });
      close();
    },
  });
  const submit = () => {
    if (target && !rollback.isPending) rollback.mutate();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('pipelines.rollback.title', { application })}
      description={t('pipelines.rollback.description')}
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="danger" onClick={submit} loading={rollback.isPending} disabled={!target}>
            {target
              ? t('pipelines.rollback.confirm', { version: target.previousVersion ?? '' })
              : t('pipelines.rollback.action')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" onKeyDown={onKeyDown}>
        <ActionError error={rollback.error} />
        {choices.length === 0 ? (
          <p className="text-13 text-tx-2">{t('pipelines.rollback.nothing')}</p>
        ) : (
          <>
            <Field label={t('pipelines.rollback.environment')}>
              <Select
                value={env}
                onChange={(event) => setPicked(event.value)}
                options={choices.map((item) => ({
                  value: item.environment.key,
                  label: item.environment.name,
                  description: t('pipelines.rollback.fromTo', {
                    from: item.version ?? '',
                    to: item.previousVersion ?? '',
                  }),
                }))}
              />
            </Field>
            <Field label={t('pipelines.rollback.reason')} hint={t('pipelines.rollback.reasonHint')}>
              <Input
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  );
}
