import type { Webhook } from '@bemmoly/shared';
import { Button, Checkbox, Field, Input, Modal, SkeletonText } from '@bemmoly/ui';
import type { KeyboardEvent } from 'react';
import { FormError } from '../../../components/form.tsx';
import { useWebhookForm } from '../../../hooks/use-webhook-form.ts';
import { EventsField, FormatField } from './webhook-form-fields.tsx';
import { SecretPanel } from './webhook-secret.tsx';

interface WebhookFormModalProps {
  /** The webhook being edited, or null for a new one. */
  editing: Webhook | null;
  onClose: () => void;
  /** After a create, once the secret has been seen: opens the new webhook. */
  onCreated?: (id: string) => void;
}

const FORM_ID = 'webhook-form';

/** New webhook and Edit: name, URL, events, format and whether it sends; then the secret, once. */
export function WebhookFormModal({ editing, onClose, onCreated }: WebhookFormModalProps) {
  const form = useWebhookForm(editing, onClose);
  const values = form.form;
  const errors = form.errors;
  if (form.created) {
    const id = form.created.id;
    return (
      <Modal open onClose={form.close} title="Copy the signing secret" width="lg">
        <SecretPanel
          secret={form.created.secret}
          doneLabel="Open webhook"
          onDone={() => {
            form.close();
            onCreated?.(id);
          }}
        />
      </Modal>
    );
  }
  const submitOnModEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) form.submit(event);
  };
  return (
    <Modal
      open
      onClose={form.close}
      width="lg"
      title={editing ? `Edit ${editing.name}` : 'New webhook'}
      description="Bemmoly sends each chosen event to this URL as it happens, signed with the webhook’s secret."
      footer={
        <>
          <Button onClick={form.close}>Cancel</Button>
          <Button variant="primary" type="submit" form={FORM_ID} loading={form.save.isPending}>
            {editing ? 'Save changes' : 'Create webhook'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={form.submit}
        onKeyDown={submitOnModEnter}
        className="flex flex-col gap-5"
      >
        <Field
          label="Name"
          hint="Who receives it, so you can tell webhooks apart."
          error={errors['name']}
        >
          <Input
            autoFocus
            placeholder="Platform channel"
            value={values.name}
            onChange={(event) => form.update({ name: event.target.value })}
          />
        </Field>
        <Field
          label="URL"
          hint="Where deliveries are posted, over http or https."
          error={errors['url']}
        >
          <Input
            type="url"
            inputMode="url"
            className="font-mono"
            placeholder="https://hooks.example.com/bemmoly"
            value={values.url}
            onChange={(event) => form.update({ url: event.target.value })}
          />
        </Field>
        {form.loading ? (
          <SkeletonText lines={4} />
        ) : (
          <EventsField
            groups={form.groups}
            chosen={values.events}
            error={errors['events']}
            onToggle={form.toggleEvent}
            onGroup={form.setGroup}
          />
        )}
        <FormatField
          formats={form.formats}
          value={values.format}
          onChange={(format) => form.update({ format })}
        />
        <Checkbox
          label="Send deliveries"
          description="Leave it off to save the webhook paused; turn it on from its page later."
          checked={values.enabled}
          onChange={(event) => form.update({ enabled: event.target.checked })}
        />
        {form.save.error && Object.keys(errors).length === 0 ? (
          <FormError error={form.save.error} />
        ) : null}
      </form>
    </Modal>
  );
}
