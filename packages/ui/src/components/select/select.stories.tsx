import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Avatar, avatarHue } from '../avatar/index.ts';
import { Field } from '../input/field.tsx';
import { Select } from './select.tsx';
import type { SelectOption, SelectProps } from './types.ts';

const meta = {
  title: 'Components/Select',
  component: Select,
} satisfies Meta<typeof Select>;

export default meta;

type Story = StoryObj<typeof meta>;

const FIRST = [
  'Aisha',
  'Bruno',
  'Chen',
  'Dana',
  'Élodie',
  'Farid',
  'Grace',
  'Hiro',
  'Ines',
  'José',
];
const LAST = ['K.', 'Lima', 'Müller', 'N.', 'Okafor', 'Park', 'Quinn', 'Rossi', 'Sato', 'Tran'];

/** 500 people, as in a mid-sized workspace. */
const PEOPLE: SelectOption[] = Array.from({ length: 500 }, (_, i) => {
  const name = `${FIRST[i % 10]} ${LAST[Math.floor(i / 10) % 10]}${i >= 100 ? ` ${i}` : ''}`;
  const id = `u${i}`;
  return {
    value: id,
    label: name,
    description: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@acme.test`,
    icon: <Avatar name={name} hue={avatarHue(id)} size={20} />,
  };
});

const ROLES: SelectOption[] = [
  { value: 'owner', label: 'Owner', disabled: true },
  { value: 'admin', label: 'Org admin' },
  { value: 'project-admin', label: 'Project admin' },
  { value: 'member', label: 'Member' },
  { value: 'guest', label: 'Guest' },
];

function Controlled(props: SelectProps) {
  const [value, setValue] = useState(props.value ?? '');
  return <Select {...props} value={value} onChange={(event) => setValue(event.target.value)} />;
}

export const Sizes: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly People.dc.html', x: 540, y: 138, w: 226, h: 48, note: 'filters, md' },
      { file: 'Bemmoly People.dc.html', x: 544, y: 238, w: 130, h: 90, note: 'role, sm' },
    ],
  },
  render: () => (
    <div className="flex w-90 flex-col items-start gap-3">
      <div className="flex gap-2">
        <Controlled aria-label="Role" placeholder="Role" options={ROLES} />
        <Controlled aria-label="Team" placeholder="Team" options={[]} />
        <Controlled aria-label="Status" placeholder="Status" options={[]} />
      </div>
      <Controlled aria-label="Org role" size="sm" value="admin" options={ROLES} />
      <Controlled aria-label="Project role" size="sm" value="project-admin" options={ROLES} />
      <Field label="Default role">
        <Controlled size="lg" value="member" options={ROLES} />
      </Field>
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="grid w-120 grid-cols-2 gap-3.5">
      <Field label="Placeholder">
        <Controlled placeholder="Choose a role…" options={ROLES} />
      </Field>
      <Field label="Disabled">
        <Controlled disabled value="member" options={ROLES} />
      </Field>
      <Field label="Error" error="Choose a role for the team.">
        <Controlled placeholder="Choose a role…" options={ROLES} />
      </Field>
      <Field label="Open">
        <Controlled value="member" options={ROLES} />
      </Field>
    </div>
  ),
};

/** A field of the Issue sidebar: plain text until hovered or focused, then the control. */
export const Ghost: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Issue.dc.html', x: 941, y: 115, w: 358, h: 120, note: 'details' }],
  },
  render: () => (
    <div className="grid w-90 grid-cols-[110px_1fr] items-center gap-y-0.5 text-12h">
      <span className="text-tx4">Assignee</span>
      <Controlled aria-label="Assignee" variant="ghost" value="u0" options={PEOPLE} />
      <span className="text-tx4">Role</span>
      <Controlled aria-label="Role" variant="ghost" value="member" options={ROLES} />
    </div>
  ),
};

export const Searchable: Story = {
  render: () => (
    <Field label="Lead" className="w-72">
      <Controlled searchable placeholder="No lead yet" value="u7" options={PEOPLE.slice(0, 40)} />
    </Field>
  ),
};

/** 500 options: 50 drawn, a footer saying so, and search on by itself. */
export const FiveHundredPeople: Story = {
  render: () => (
    <Field label="Assignee" className="w-72">
      <Controlled value="u321" options={PEOPLE} />
    </Field>
  ),
};

async function searchPeople(query: string, signal: AbortSignal): Promise<SelectOption[]> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (signal.aborted) return [];
  const q = query.toLowerCase();
  return PEOPLE.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 50);
}

/** The first page comes with the page; typing asks the (simulated, 400ms) server. */
export const ServerSearch: Story = {
  render: () => (
    <Field label="Grant to" className="w-72">
      <Controlled
        value="u0"
        placeholder="Choose a person…"
        options={PEOPLE.slice(0, 50)}
        loadOptions={searchPeople}
      />
    </Field>
  ),
};

export const Grouped: Story = {
  render: () => (
    <Field label="Who" className="w-72">
      <Controlled
        searchable
        value="t-platform"
        groups={[
          {
            label: 'Teams',
            options: [
              { value: 't-platform', label: 'Platform' },
              { value: 't-design', label: 'Design' },
            ],
          },
          { label: 'Roles', options: ROLES.slice(1) },
          { label: 'People', options: PEOPLE.slice(0, 8) },
        ]}
      />
    </Field>
  ),
};

/** The popover is portalled, so the card's overflow-hidden no longer cuts it off. */
export const InsideAClippingCard: Story = {
  render: () => (
    <div className="h-24 w-80 overflow-hidden rounded-card border border-br bg-sf p-3">
      <Field label="Starts on">
        <Controlled
          value="tue"
          options={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day) => ({
            value: day.slice(0, 3).toLowerCase(),
            label: day,
          }))}
        />
      </Field>
    </div>
  ),
};
