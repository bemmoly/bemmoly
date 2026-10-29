import { useT } from '@bemmoly/core-web';
import type { CloudConnection } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Input, Modal } from '@bemmoly/ui';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useAccountWrites } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import {
  attachBodyOf,
  attachProblems,
  attachReady,
  EMPTY_ATTACH,
  type AttachDraft,
} from './attach-body.ts';
import { ProjectSummary } from './project-summary.tsx';

/**
 * Attach a project…: the project ID, and optionally a name and who Pipelines deploys and runs
 * as there. The answer is the project as its check found it; a failed one is kept, so the
 * dialog shows what to grant rather than an error.
 */
export function AttachDialog({
  connection,
  open,
  onClose,
}: {
  connection: CloudConnection;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(pipelinesText);
  const { attach } = useAccountWrites(connection.id);
  const [draft, setDraft] = useState<AttachDraft>(EMPTY_ATTACH);
  const set = (patch: Partial<AttachDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const problems = attachProblems(draft);
  const ready = attachReady(draft);
  const result = attach.data;
  const close = () => {
    attach.reset();
    setDraft(EMPTY_ATTACH);
    onClose();
  };
  const submit = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault();
    if (ready && !attach.isPending) attach.mutate(attachBodyOf(draft));
  };
  // Enter in any field attaches, as the footer button does; the footer sits outside the form.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') submit(event);
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={
        result
          ? result.status === 'ready'
            ? t('pipelines.clouds.attachedReady', { project: result.externalId })
            : t('pipelines.clouds.attachedNeeds', { project: result.externalId })
          : t('pipelines.clouds.attachTitle', { name: connection.name })
      }
      description={result ? undefined : t('pipelines.clouds.attachDescription')}
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            {t('pipelines.capacity.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('pipelines.common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!ready}
              loading={attach.isPending}
              onClick={() => submit()}
            >
              {t('pipelines.clouds.attachConfirm')}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-3">
          <ProjectSummary account={result} />
          <p className="text-12 text-tx-3">
            {result.status === 'ready'
              ? t('pipelines.clouds.attachedReadyNext')
              : t('pipelines.clouds.attachedNeedsNext')}
          </p>
        </div>
      ) : (
        <form className="flex flex-col gap-3.5" onSubmit={submit} onKeyDown={onKeyDown}>
          <Field
            label={t('pipelines.clouds.projectId')}
            error={problems.has('externalId') ? t('pipelines.clouds.projectIdInvalid') : null}
          >
            <Input
              mono
              autoFocus
              value={draft.externalId}
              placeholder={t('pipelines.clouds.projectIdExample')}
              onChange={(event) => set({ externalId: event.target.value.trim() })}
            />
          </Field>
          <Field
            label={t('pipelines.clouds.displayName')}
            hint={t('pipelines.clouds.displayNameHint')}
          >
            <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
          </Field>
          <Field
            label={t('pipelines.clouds.deployAs')}
            hint={t('pipelines.clouds.deployAsHint')}
            error={problems.has('deployer') ? t('pipelines.clouds.serviceAccountInvalid') : null}
          >
            <Input
              mono
              value={draft.deployer}
              onChange={(event) => set({ deployer: event.target.value })}
            />
          </Field>
          <Field
            label={t('pipelines.clouds.runAs')}
            hint={t('pipelines.clouds.runAsHint')}
            error={problems.has('runtime') ? t('pipelines.clouds.serviceAccountInvalid') : null}
          >
            <Input
              mono
              value={draft.runtime}
              onChange={(event) => set({ runtime: event.target.value })}
            />
          </Field>
          <ActionError error={attach.error} />
        </form>
      )}
    </Modal>
  );
}
