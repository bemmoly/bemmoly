import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SegmentedControl } from '../segmented-control/segmented-control.tsx';
import { Select } from '../select/select.tsx';
import { Switch } from '../switch/switch.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import { Checkbox, Radio } from './checkbox.tsx';

const meta = { title: 'Components/Controls', component: Checkbox } satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CheckboxAndRadio: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly People.dc.html', x: 620, y: 600, w: 300, h: 60, note: 'see Roles view' },
    ],
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Checkbox aria-label="Org admin" size="md" defaultChecked disabled />
        <Checkbox aria-label="Project admin" size="md" defaultChecked />
        <Checkbox aria-label="Member" size="md" />
      </div>
      <Checkbox label="Issue type" description="icon" defaultChecked />
      <Radio name="method" label="Scrum" description="Sprints, backlog, velocity." defaultChecked />
      <Radio name="method" label="Kanban" description="Continuous flow, WIP limits." />
    </div>
  ),
};

export const Switches: Story = {
  parameters: {
    mock: [
      {
        file: 'Bemmoly Appearance Settings.dc.html',
        x: 281,
        y: 1420,
        w: 398,
        h: 121,
        viewport: { width: 1440, height: 1500 },
        note: 'Policy',
      },
    ],
  },
  render: function Render() {
    const [a, setA] = useState(true);
    const [b, setB] = useState(false);
    return (
      <div className="flex items-center gap-3">
        <Switch aria-label="Let members switch light and dark" checked={a} onCheckedChange={setA} />
        <Switch aria-label="Allow personal themes" checked={b} onCheckedChange={setB} />
        <Switch aria-label="Lock" size="sm" checked={a} onCheckedChange={setA} />
      </div>
    );
  },
};

export const Segmented: Story = {
  parameters: {
    mock: [
      {
        file: 'Bemmoly Appearance Settings.dc.html',
        x: 297,
        y: 968,
        w: 366,
        h: 72,
        viewport: { width: 1440, height: 1500 },
        note: 'Mode and Surfaces',
      },
      { file: 'Bemmoly Board.dc.html', x: 1210, y: 748, w: 216, h: 36, note: 'Activity' },
    ],
  },
  render: function Render() {
    const [mode, setMode] = useState<'light' | 'dark'>('light');
    const [tone, setTone] = useState<'neutral' | 'tinted'>('neutral');
    const [tab, setTab] = useState<'comments' | 'history' | 'log'>('comments');
    return (
      <div className="flex w-92 flex-col gap-3">
        <div className="grid grid-cols-2 gap-3.5">
          <SegmentedControl
            aria-label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <SegmentedControl
            aria-label="Surfaces"
            value={tone}
            onChange={setTone}
            options={[
              { value: 'neutral', label: 'Neutral grey' },
              { value: 'tinted', label: 'Brand-tinted' },
            ]}
          />
        </div>
        <SegmentedControl
          aria-label="Activity"
          size="sm"
          className="self-start"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'comments', label: 'Comments' },
            { value: 'history', label: 'History' },
            { value: 'log', label: 'Work log' },
          ]}
        />
      </div>
    );
  },
};

export const SelectAndTextarea: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly People.dc.html', x: 620, y: 240, w: 140, h: 120, note: 'role select' }],
  },
  render: () => (
    <div className="flex w-90 flex-col gap-3">
      <Select
        aria-label="Org role"
        size="sm"
        wrapperClassName="self-start"
        defaultValue="admin"
        options={[
          { value: 'admin', label: 'Org admin' },
          { value: 'member', label: 'Member' },
        ]}
      />
      <Select
        aria-label="Starts on"
        defaultValue="tue"
        options={[
          { value: 'mon', label: 'Monday' },
          { value: 'tue', label: 'Tuesday' },
        ]}
      />
      <Textarea aria-label="Emails" placeholder="Paste more, comma or newline separated…" />
    </div>
  ),
};
