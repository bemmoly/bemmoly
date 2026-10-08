import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Field } from '../input/field.tsx';
import { Input } from '../input/input.tsx';
import { ConfirmChange } from './confirm-change.tsx';
import { SettingsSection } from './settings-section.tsx';
import { SettingsValue, SettingsValues } from './settings-values.tsx';
import { UnsavedChangesBar } from './unsaved-bar.tsx';

const noop = () => {};

const meta = {
  title: 'Components/Settings edit pattern',
  parameters: {
    layout: 'padded',
    mock: [
      {
        file: 'Bemmoly Backups Settings.dc.html',
        x: 280,
        y: 330,
        w: 520,
        h: 220,
        note: 'retention card; the read and edit modes are new',
      },
    ],
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Read view, Edit, then Cancel or Save; Save waits for a change. */
export const ReadThenEdit: Story = {
  render: function Render() {
    const [mode, setMode] = useState<'read' | 'edit'>('read');
    const [daily, setDaily] = useState('7');
    const [draft, setDraft] = useState(daily);
    return (
      <div className="w-130">
        <SettingsSection
          title="Retention"
          hint="How many of each to keep"
          mode={mode}
          dirty={draft !== daily}
          onEdit={() => setMode('edit')}
          onCancel={() => {
            setDraft(daily);
            setMode('read');
          }}
          onSave={() => {
            setDaily(draft);
            setMode('read');
          }}
        >
          {mode === 'read' ? (
            <SettingsValues>
              <SettingsValue label="Daily">{daily} kept</SettingsValue>
              <SettingsValue label="Pre-update" hint="Kept whatever the tiers say">
                7 days
              </SettingsValue>
            </SettingsValues>
          ) : (
            <Field label="Daily">
              <Input mono value={draft} onChange={(event) => setDraft(event.target.value)} />
            </Field>
          )}
        </SettingsSection>
      </div>
    );
  },
};

/** A change that loses data asks for a typed word. */
export const DangerousChange: Story = {
  render: () => (
    <ConfirmChange
      open
      title="Lower retention?"
      description="Fewer backups are kept from the next prune on."
      consequences={[
        'Daily backups kept: 7 → 3. Up to 4 older daily backups are deleted at the next prune.',
        'Deleted backups cannot be restored.',
      ]}
      confirmWord="confirm"
      confirmLabel="Lower retention"
      onConfirm={noop}
      onCancel={noop}
    />
  ),
};

export const UnsavedBar: Story = {
  render: () => (
    <div className="w-200">
      <UnsavedChangesBar
        sections={[
          { id: 'schedule', title: 'Schedule' },
          { id: 'retention', title: 'Retention' },
        ]}
        onDiscardAll={noop}
      />
    </div>
  ),
};
