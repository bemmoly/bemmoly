import type { Project } from '@bemmoly/module-work/shared';
import { Button, Field, Input, Modal, Select, SelectableCard } from '@bemmoly/ui';
import { usePeople } from '../hooks/issue-people.ts';
import { useCreateProject, useTeams } from '../hooks/projects-list.ts';

const METHODS = [
  {
    value: 'scrum',
    name: 'Scrum',
    text: 'Plan sprints from a backlog, estimate in points and track velocity.',
  },
  {
    value: 'kanban',
    name: 'Kanban',
    text: 'Pull work through columns with WIP limits; no sprints to plan.',
  },
] as const;

export interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

/**
 * Create project: name, key, Scrum or Kanban and the owning team, whose lead leads the
 * project. Types, fields, workflow and board come from the org defaults until overridden.
 */
export function CreateProjectDialog(props: CreateProjectDialogProps) {
  return props.open ? <CreateProjectForm {...props} /> : null;
}

function CreateProjectForm({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const form = useCreateProject(onCreated);
  const teams = useTeams();
  const { person } = usePeople();
  const { draft, errors } = form;
  const team = teams.data?.items.find((item) => item.id === draft.teamId);
  const lead = team?.leadUserId ? person(team.leadUserId).name : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title="Create project"
      description="It starts with the workspace's issue types, fields, workflow and board."
      footer={
        <>
          {errors.form && (
            <span role="alert" className="mr-auto text-12h text-danger">
              {errors.form}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={form.isSubmitting} onClick={form.submit}>
            Create project
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
              placeholder="Platform Core"
              onChange={(event) => form.setName(event.target.value)}
            />
          </Field>
          <Field label="Key" error={errors.key} hint={errors.key ? undefined : 'As in PLT-142'}>
            <Input
              mono
              value={draft.key}
              maxLength={10}
              placeholder="PLT"
              onChange={(event) => form.setKey(event.target.value)}
            />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="project-method" className="font-medium text-tx">
            Method
          </span>
          <div
            role="radiogroup"
            aria-labelledby="project-method"
            className="grid grid-cols-2 gap-2.5"
          >
            {METHODS.map((method) => (
              <SelectableCard
                key={method.value}
                selected={draft.method === method.value}
                onClick={() => form.set('method', method.value)}
              >
                <span className="font-semibold">{method.name}</span>
                <span className="text-12h leading-body text-tx4">{method.text}</span>
              </SelectableCard>
            ))}
          </div>
        </div>
        <Field
          label="Team"
          hint={
            lead
              ? `Lead: ${lead}, the team's lead`
              : 'The team that owns the project; its lead leads it.'
          }
        >
          <Select
            value={draft.teamId}
            placeholder="No team yet"
            options={[
              { value: '', label: 'No team yet' },
              ...(teams.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
            ]}
            onChange={(event) => form.set('teamId', event.value)}
          />
        </Field>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
