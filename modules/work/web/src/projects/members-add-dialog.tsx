import type { AddProjectMembersBody } from '@bemmoly/module-work/shared';
import {
  Button,
  Field,
  Modal,
  Select,
  Tag,
  type LoadOptions,
  type SelectOption,
} from '@bemmoly/ui';
import { useState } from 'react';
import { useTeams } from '../hooks/projects-list.ts';

const DEFAULT_ROLE = '';

export interface MembersAddDialogProps {
  open: boolean;
  projectName: string;
  roleOptions: readonly SelectOption[];
  loadPeople: LoadOptions;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onAdd: (body: AddProjectMembersBody) => void;
}

/**
 * Add people: pick people (searched on the server) and whole teams, then one
 * role for all of them, or the default: each team's default role, else Member.
 */
export function MembersAddDialog(props: MembersAddDialogProps) {
  return props.open ? <AddForm {...props} /> : null;
}

function AddForm({
  open,
  projectName,
  roleOptions,
  loadPeople,
  busy,
  error,
  onClose,
  onAdd,
}: MembersAddDialogProps) {
  const teams = useTeams();
  const [people, setPeople] = useState<SelectOption[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [roleId, setRoleId] = useState(DEFAULT_ROLE);
  const teamOptions = (teams.data?.items ?? [])
    .filter((team) => !teamIds.includes(team.id))
    .map((team) => ({ value: team.id, label: team.name }));
  const teamName = (id: string) => teams.data?.items.find((team) => team.id === id)?.name ?? id;
  const empty = people.length === 0 && teamIds.length === 0;

  const submit = () =>
    onAdd({
      userIds: people.map((person) => person.value),
      teamIds,
      ...(roleId ? { roleId } : {}),
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="md"
      title={`Add people to ${projectName}`}
      description="They can open the project's issues, board and backlog as soon as they are added."
      footer={
        <>
          {error && (
            <span role="alert" className="mr-auto text-12h text-danger">
              {error}
            </span>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={empty} onClick={submit}>
            Add to project
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label="People" hint="Search by name or email.">
          <Select
            value=""
            placeholder="Find a person"
            searchPlaceholder="Search people"
            loadOptions={loadPeople}
            onChange={(event) =>
              setPeople((current) =>
                current.some((person) => person.value === event.value)
                  ? current
                  : [...current, event.option],
              )
            }
          />
        </Field>
        <Field label="Teams" hint="Everyone in the team joins, as the team is today.">
          <Select
            value=""
            placeholder="Add a whole team"
            searchable
            searchPlaceholder="Search teams"
            options={teamOptions}
            onChange={(event) => setTeamIds((current) => [...current, event.value])}
          />
        </Field>
        {!empty && (
          <div className="flex flex-wrap gap-1.5" aria-label="To add">
            {people.map((person) => (
              <Tag
                key={person.value}
                size="md"
                removeLabel={`Remove ${person.label}`}
                onRemove={() =>
                  setPeople((current) => current.filter((item) => item.value !== person.value))
                }
              >
                {person.label}
              </Tag>
            ))}
            {teamIds.map((id) => (
              <Tag
                key={id}
                size="md"
                tone="accent"
                removeLabel={`Remove ${teamName(id)}`}
                onRemove={() => setTeamIds((current) => current.filter((item) => item !== id))}
              >
                {teamName(id)}
              </Tag>
            ))}
          </div>
        )}
        <Field label="Project role">
          <Select
            value={roleId}
            options={[
              {
                value: DEFAULT_ROLE,
                label: 'Default',
                description: "Team's default role, else Member",
              },
              ...roleOptions,
            ]}
            onChange={(event) => setRoleId(event.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
