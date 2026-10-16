import { useT } from '@bemmoly/core-web';
import { Button, Field, Input, Modal } from '@bemmoly/ui';
import { useState, type FormEvent } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';

/** Names the current filters as a view of the person's own; Mod+Enter saves from the field. */
export function SaveViewDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const t = useT(pipelinesText);
  const [name, setName] = useState('');
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="sm"
      title={t('pipelines.catalog.saveViewTitle')}
      description={t('pipelines.catalog.saveViewDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('pipelines.common.cancel')}
          </Button>
          <Button variant="primary" onClick={() => submit()} disabled={!name.trim()}>
            {t('pipelines.catalog.saveView')}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        <Field label={t('pipelines.catalog.saveViewName')}>
          <Input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('pipelines.catalog.saveViewPlaceholder')}
          />
        </Field>
      </form>
    </Modal>
  );
}
