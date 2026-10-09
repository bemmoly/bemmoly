import { isApiError } from '@bemmoly/api-client';
import { Button, Field, Input, Modal, Select } from '@bemmoly/ui';
import { useState } from 'react';
import type { SaveFilterInput, TeamChoice } from '../hooks/saved-filters.ts';

export interface SaveFilterDialogProps {
  open: boolean;
  /** The LQL the board has applied; it is saved as it is. */
  query: string;
  teams: readonly TeamChoice[];
  busy: boolean;
  error: unknown;
  onSave: (input: SaveFilterInput) => void;
  onClose: () => void;
}

const PRIVATE = 'private';

/** Names the board's applied LQL and says who else sees it: nobody, or one of my teams. */
export function SaveFilterDialog(props: SaveFilterDialogProps) {
  const [name, setName] = useState('');
  const [audience, setAudience] = useState(PRIVATE);
  const close = () => {
    setName('');
    setAudience(PRIVATE);
    props.onClose();
  };
  const ready = name.trim() !== '' && !props.busy;
  const save = () => {
    if (ready)
      props.onSave({ name, query: props.query, teamId: audience === PRIVATE ? null : audience });
  };
  const message = props.error
    ? isApiError(props.error)
      ? props.error.message
      : 'The filter was not saved. Try again.'
    : undefined;
  return (
    <Modal
      open={props.open}
      onClose={close}
      title="Save filter"
      description="Saved filters are listed beside the LQL bar on this project's board."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" disabled={!ready} loading={props.busy} onClick={save}>
            Save filter
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Name" error={message}>
          <Input
            autoFocus
            value={name}
            maxLength={120}
            placeholder="My open bugs"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label="Query">
          <Input mono readOnly value={props.query} />
        </Field>
        <Field
          label="Who sees it"
          hint="Shared filters show for everyone in the team; only you can change them."
        >
          <Select
            searchable
            searchPlaceholder="Search your teams"
            value={audience}
            options={[
              { value: PRIVATE, label: 'Only me' },
              ...props.teams.map((team) => ({ value: team.id, label: team.name })),
            ]}
            onChange={(event) => setAudience(event.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
