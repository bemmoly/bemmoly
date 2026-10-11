import type { Space } from '@bemmoly/module-docs/shared';
import { Button, Field, Input, Modal, SPACE_TONES, SpaceTile, Textarea } from '@bemmoly/ui';
import { useCreateSpace } from './use-create-space.ts';

export interface CreateSpaceDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (space: Space) => void;
}

const TONE_NAMES: Record<(typeof SPACE_TONES)[number], string> = {
  accent: 'Blue',
  violet: 'Violet',
  green: 'Green',
  orange: 'Orange',
  red: 'Red',
  amber: 'Amber',
  slate: 'Slate',
};

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
        <div className="flex flex-col gap-1.5">
          <span id="space-colour" className="font-medium text-tx">
            Colour
          </span>
          <div role="radiogroup" aria-labelledby="space-colour" className="flex gap-2">
            {SPACE_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                role="radio"
                aria-checked={draft.tone === tone}
                aria-label={TONE_NAMES[tone]}
                onClick={() => form.setTone(tone)}
                className={`cursor-pointer rounded-card border-0 bg-transparent p-0.5 outline-offset-1 focus-ring ${
                  draft.tone === tone ? 'shadow-ring-ac' : 'hover:shadow-ring'
                }`}
              >
                <SpaceTile
                  name={draft.name}
                  {...(draft.key ? { spaceKey: draft.key } : {})}
                  tone={tone}
                  size="sm"
                />
              </button>
            ))}
          </div>
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
