import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TemplatePicker } from './template-picker.tsx';

const TEMPLATES = [
  {
    id: 'rfc',
    name: 'RFC / design doc',
    description: 'Context, proposal, rollout and open questions.',
    category: 'Engineering',
  },
  {
    id: 'pm',
    name: 'Postmortem',
    description: 'Timeline, impact, causes and follow-up issues.',
    category: 'Engineering',
  },
  {
    id: 'run',
    name: 'Runbook',
    description: 'Steps on-call can follow at 3am.',
    category: 'Engineering',
  },
  {
    id: 'spec',
    name: 'Product spec',
    description: 'Problem, users, scope and success measures.',
    category: 'Product',
  },
  { id: 'notes', name: 'Meeting notes', description: 'Attendees, decisions and action items.' },
  { id: 'dec', name: 'Decision log', description: 'One decision a row, with who and why.' },
];

const meta = {
  title: 'Docs/Template picker',
  component: TemplatePicker,
  args: { templates: TEMPLATES, selectedId: null, onSelect: () => undefined },
  parameters: {
    mock: [
      { file: 'Bemmoly Docs.dc.html', x: 841, y: 965, w: 438, h: 160, note: 'templates panel' },
    ],
  },
  render: function Render(args) {
    const [selected, setSelected] = useState<string | null>(args.selectedId);
    return (
      <div className="w-140">
        <TemplatePicker {...args} selectedId={selected} onSelect={setSelected} />
      </div>
    );
  },
} satisfies Meta<typeof TemplatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Templates: Story = {};

export const Loading: Story = { args: { loading: true } };

export const Failed: Story = { args: { error: 'Templates could not be loaded.' } };
