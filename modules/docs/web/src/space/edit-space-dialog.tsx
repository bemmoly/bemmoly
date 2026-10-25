import type { Space } from '@bemmoly/module-docs/shared';
import { Button, Field, Input, Modal, Textarea } from '@bemmoly/ui';
import { SpaceTonePicker } from '../create/space-tone-picker.tsx';
import { useSpaceMembers } from './overview/use-overview.ts';
import { useEditSpace } from './use-edit-space.ts';

export interface EditSpaceDialogProps {
  space: Space;
  open: boolean;
  onClose: () => void;
}

/** Whether the signed-in person may edit this space, as the server answers it for the space. */
export function useCanEditSpace(spaceKey: string): boolean {
  return useSpaceMembers(spaceKey).data?.canManage ?? false;
}

/**
 * Edit space: rename it, change the line on what it holds, or its colour. The key is shown
 * but fixed, because links into the space carry it.
 */
export function EditSpaceDialog(props: EditSpaceDialogProps) {
  return props.open ? <EditSpaceForm {...props} /> : null;
}

function EditSpaceForm({ space, open, onClose }: EditSpaceDialogProps) {
  const form = useEditSpace(space, onClose);
  const { draft, errors } = form;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title="Edit space"
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
            Save
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
              onChange={(event) => form.setName(event.target.value)}
            />
          </Field>
          <Field label="Key" hint="Fixed: links use it">
            <Input mono value={space.key} readOnly disabled />
          </Field>
        </div>
        <Field label="Description" hint="Optional. Shown on the space's overview.">
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(event) => form.setDescription(event.target.value)}
          />
        </Field>
        <SpaceTonePicker
          name={draft.name}
          spaceKey={space.key}
          value={draft.tone}
          onChange={form.setTone}
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
