import { useShortcutHelp, useT } from '@bemmoly/core-web';
import type { ChangeRequestDetail } from '@bemmoly/module-pipelines/shared';
import { Button, Field, Kbd, Modal, Textarea, useToast } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useScreenKeys } from '../../hooks/use-screen-keys.ts';
import { changeRequestsText } from '../../i18n/catalog.ts';
import { refusalOf } from '../../parts/load-failed.tsx';
import { useChangeRequestWrites } from './use-change-requests.ts';

/*
 * What the viewer may do with a request, at the end of its title row: an approver approves
 * (A), rejects or asks for changes; the person who asked sends a draft, edits it or withdraws.
 * Rejecting and asking for changes take a note the requester reads.
 */

type Dialog = 'reject' | 'changes' | 'withdraw' | null;

function NoteDialog({
  open,
  title,
  description,
  confirm,
  required,
  danger,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirm: string;
  required: boolean;
  danger?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const t = useT(changeRequestsText);
  const [note, setNote] = useState('');
  const ready = !required || note.trim().length > 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelinesChangeRequests.common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready}
            loading={busy}
            onClick={() => onConfirm(note.trim())}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <Field label={t('pipelinesChangeRequests.actions.note')}>
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </Modal>
  );
}

export function DecisionActions({ request }: { request: ChangeRequestDetail }) {
  const t = useT(changeRequestsText);
  const toast = useToast();
  const navigate = useNavigate();
  const writes = useChangeRequestWrites();
  const [dialog, setDialog] = useState<Dialog>(null);
  const number = request.number;
  const failed = (error: unknown) =>
    toast.show({
      tone: 'danger',
      title: t('pipelinesChangeRequests.actions.failed'),
      body: refusalOf(error)?.sentence ?? (error instanceof Error ? error.message : ''),
    });
  const approve = () => {
    if (!request.can.approve || writes.approve.isPending) return;
    writes.approve.mutate(
      { number },
      {
        onSuccess: (next) =>
          toast.show({
            tone: 'ok',
            title: t(
              next.status === 'waiting'
                ? 'pipelinesChangeRequests.actions.approvedWaiting'
                : 'pipelinesChangeRequests.actions.approvedDeploying',
              { name: request.environment.name },
            ),
          }),
        onError: failed,
      },
    );
  };
  useScreenKeys({ a: approve });
  useShortcutHelp({
    id: 'pipelines.change-request',
    label: t('pipelinesChangeRequests.detail.keys'),
    keys: [{ keys: 'A', label: t('pipelinesChangeRequests.actions.approve') }],
  });
  const close = () => setDialog(null);
  return (
    <>
      {request.can.approve ? (
        <>
          <Button variant="secondary" onClick={() => setDialog('changes')}>
            {t('pipelinesChangeRequests.actions.askChanges')}
          </Button>
          <Button variant="secondary" onClick={() => setDialog('reject')}>
            {t('pipelinesChangeRequests.actions.reject')}
          </Button>
          <Button
            variant="primary"
            icon={<Icon name="check" size={14} />}
            loading={writes.approve.isPending}
            onClick={approve}
            iconEnd={
              <span className="hidden md:inline-flex">
                <Kbd keys="A" />
              </span>
            }
          >
            {t('pipelinesChangeRequests.actions.approve')}
          </Button>
        </>
      ) : null}
      {request.can.edit ? (
        <Button
          variant="secondary"
          icon={<Icon name="edit" size={14} />}
          onClick={() => void navigate({ to: '/changes/new', search: { edit: number } as never })}
        >
          {t('pipelinesChangeRequests.actions.edit')}
        </Button>
      ) : null}
      {request.can.withdraw ? (
        <Button variant="ghost" onClick={() => setDialog('withdraw')}>
          {t('pipelinesChangeRequests.actions.withdraw')}
        </Button>
      ) : null}
      {request.can.send ? (
        <Button
          variant="primary"
          loading={writes.send.isPending}
          onClick={() =>
            writes.send.mutate(number, {
              onSuccess: () =>
                toast.show({ tone: 'ok', title: t('pipelinesChangeRequests.actions.sent') }),
              onError: failed,
            })
          }
        >
          {t('pipelinesChangeRequests.actions.send')}
        </Button>
      ) : null}
      <NoteDialog
        open={dialog === 'reject'}
        title={t('pipelinesChangeRequests.actions.rejectTitle', { number })}
        description={t('pipelinesChangeRequests.actions.rejectDescription')}
        confirm={t('pipelinesChangeRequests.actions.reject')}
        required
        danger
        busy={writes.reject.isPending}
        onClose={close}
        onConfirm={(note) =>
          writes.reject.mutate(
            { number, body: { kind: 'reject', note } },
            { onSuccess: close, onError: failed },
          )
        }
      />
      <NoteDialog
        open={dialog === 'changes'}
        title={t('pipelinesChangeRequests.actions.changesTitle')}
        description={t('pipelinesChangeRequests.actions.changesDescription')}
        confirm={t('pipelinesChangeRequests.actions.askChanges')}
        required
        busy={writes.reject.isPending}
        onClose={close}
        onConfirm={(note) =>
          writes.reject.mutate(
            { number, body: { kind: 'changes_requested', note } },
            { onSuccess: close, onError: failed },
          )
        }
      />
      <NoteDialog
        open={dialog === 'withdraw'}
        title={t('pipelinesChangeRequests.actions.withdrawTitle', { number })}
        description={t('pipelinesChangeRequests.actions.withdrawDescription')}
        confirm={t('pipelinesChangeRequests.actions.withdraw')}
        required={false}
        busy={writes.withdraw.isPending}
        onClose={close}
        onConfirm={(note) =>
          writes.withdraw.mutate(
            { number, ...(note ? { reason: note } : {}) },
            { onSuccess: close, onError: failed },
          )
        }
      />
    </>
  );
}
