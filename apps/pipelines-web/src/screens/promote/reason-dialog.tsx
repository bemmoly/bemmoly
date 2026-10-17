import { useT } from '@bemmoly/core-web';
import { Button, Field, Modal, Textarea } from '@bemmoly/ui';
import { useState } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';

/** Asks for the words a decision keeps on record: why it was rejected, or why a freeze gave. */
export function ReasonDialog({
  open,
  title,
  description,
  label,
  confirm,
  minLength = 0,
  danger = false,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  label: string;
  confirm: string;
  minLength?: number;
  danger?: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useT(pipelinesText);
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= minLength;
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
            {t('pipelines.common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            disabled={!ready}
            loading={busy}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirm}
          </Button>
        </>
      }
    >
      <Field
        label={label}
        hint={minLength ? t('pipelines.promote.reasonLength', { count: minLength }) : undefined}
      >
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && ready) {
              onConfirm(reason.trim());
            }
          }}
        />
      </Field>
    </Modal>
  );
}
