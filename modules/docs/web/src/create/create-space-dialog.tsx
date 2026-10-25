import type { Space } from '@bemmoly/module-docs/shared';
import { Button, Field, Input, Modal, Textarea } from '@bemmoly/ui';
import { SpaceTonePicker } from './space-tone-picker.tsx';
import { useCreateSpace } from './use-create-space.ts';

export interface CreateSpaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (space: Space) => void;
}

/**
 * Create space: a name, the key that prefixes its links ("ENG"), an optional line on what it
 * holds, and its colour. The person who creates it becomes its first member.
 */
export function CreateSpaceDialog(props: CreateSpaceDialogProps) {
  return props.open ? <CreateSpaceForm {...props} /> : null;
}

function CreateSpaceForm({ open, onClose, onCreated }: CreateSpaceDialogProps) {
  const form = useCreateSpace(onCreated);
  const { draft, errors } = form;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title="Create space"
      description="A space holds one team's or one topic's pages, with its own members."
      footer={
        <>
          {errors.form && (
            <span role="alert" className="mr-auto text-13 text-red">
              {errors.form}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={form.isSubmitting} onClick={form.submit}>
            Create space
          </Button>
        </>
      }
    >
      <form
        noValidate
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          form.submit();
        }}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3.5">
          <Field label="Name" error={errors.name}>
            <Input
              autoFocus
              value={draft.name}
              placeholder="Engineering"
              onChange={(event) => form.setName(event.target.value)}
            />
          </Field>
          <Field label="Key" error={errors.key} hint={errors.key ? undefined : 'In links: /s/ENG'}>
            <Input
              mono
              value={draft.key}
              maxLength={10}
              placeholder="ENG"
              onChange={(event) => form.setKey(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Description" hint="Optional. Shown on the space's overview.">
          <Textarea
            rows={2}
            value={draft.description}
            placeholder="Architecture, runbooks and postmortems"
            onChange={(event) => form.setDescription(event.target.value)}
          />
        </Field>
        <SpaceTonePicker
          name={draft.name}
          spaceKey={draft.key}
          value={draft.tone}
          onChange={form.setTone}
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
