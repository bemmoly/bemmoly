import { isApiError } from '@bemmoly/api-client';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useState } from 'react';

/** "Spec doc" → "spec_doc": the key a new type or field is created with. */
export const keyOf = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40);

export interface AddDialogProps<K extends string> {
  open: boolean;
  title: string;
  /** "Kind" for a field, "Level" for an issue type. */
  choiceLabel: string;
  choices: readonly { value: K; label: string }[];
  initialChoice: K;
  busy: boolean;
  error: unknown;
  confirmLabel: string;
  onSubmit: (value: { name: string; key: string; choice: K }) => void;
  onClose: () => void;
}

/** The small form behind "+ Add" on the scheme pages: a name, its key and one choice. */
export function AddDialog<K extends string>(props: AddDialogProps<K>) {
  const [name, setName] = useState('');
  const [choice, setChoice] = useState<K>(props.initialChoice);
  const key = keyOf(name);
  const close = () => {
    setName('');
    props.onClose();
  };
  const submit = () => {
    if (key && !props.busy) props.onSubmit({ name: name.trim(), key, choice });
  };
  return (
    <Modal
      open={props.open}
      onClose={close}
      title={props.title}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!key} loading={props.busy} onClick={submit}>
            {props.confirmLabel}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field
          label="Name"
          hint={key ? `Key: ${key}` : 'Letters first; the key is made from the name.'}
          error={
            props.error
              ? isApiError(props.error)
                ? props.error.message
                : 'Not created'
              : undefined
          }
        >
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label={props.choiceLabel}>
          <Select
            value={choice}
            options={props.choices}
            onChange={(event) => setChoice(event.value as K)}
          />
        </Field>
      </form>
    </Modal>
  );
}
