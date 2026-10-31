import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { LoadOptions } from '../select/types.ts';
import { CustomFieldControl, type CustomFieldControlSpec } from './custom-field-control.tsx';
import { FormSections } from './form-sections.tsx';

const meta = {
  title: 'Components/CustomField',
  component: CustomFieldControl,
} satisfies Meta<typeof CustomFieldControl>;

export default meta;

type Story = StoryObj<typeof meta>;

const DEVICES = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
  { value: 'monitor', label: 'Monitor' },
];

const PEOPLE = ['Aisha Okafor', 'Bruno Lima', 'Chen Park'].map((name, index) => ({
  value: `0199c7a0-0000-7000-8000-00000000000${index}`,
  label: name,
}));

const loadPeople: LoadOptions = async (query) =>
  PEOPLE.filter((person) => person.label.toLowerCase().includes(query.toLowerCase()));

export const FIELDS: CustomFieldControlSpec[] = [
  { key: 'title', label: 'Title', kind: 'text', required: true },
  { key: 'reason', label: 'Why you need it', kind: 'long_text', description: 'One or two lines' },
  { key: 'quantity', label: 'Quantity', kind: 'number', decimals: 0 },
  { key: 'budget', label: 'Budget', kind: 'money', currency: 'EUR' },
  { key: 'needed_by', label: 'Needed by', kind: 'date' },
  { key: 'device', label: 'Device', kind: 'select', options: DEVICES, required: true },
  { key: 'extras', label: 'Extras', kind: 'multi_select', options: DEVICES },
  { key: 'manager', label: 'Manager', kind: 'person' },
  { key: 'urgent', label: 'Urgent', kind: 'boolean', description: 'Skips the queue' },
];

function Playground({ errors = {} }: { errors?: Record<string, string> }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  return (
    <div className="w-120 max-w-full">
      <FormSections
        sections={[
          {
            id: 'what',
            title: 'What you need',
            columns: 2,
            items: FIELDS.slice(0, 6).map((field) => ({
              key: field.key,
              full: field.kind === 'long_text' || field.kind === 'text',
              node: (
                <CustomFieldControl
                  field={field}
                  value={values[field.key] ?? null}
                  error={errors[field.key]}
                  onChange={(value) => setValues((all) => ({ ...all, [field.key]: value }))}
                />
              ),
            })),
          },
          {
            id: 'who',
            title: 'Approval',
            description: 'Your manager sees this request first.',
            items: FIELDS.slice(6).map((field) => ({
              key: field.key,
              node: (
                <CustomFieldControl
                  field={field}
                  value={values[field.key] ?? null}
                  error={errors[field.key]}
                  loadPeople={loadPeople}
                  knownOptions={PEOPLE}
                  onChange={(value) => setValues((all) => ({ ...all, [field.key]: value }))}
                />
              ),
            })),
          },
        ]}
      />
    </div>
  );
}

/** Every kind in a two-section form. */
export const AllKinds: Story = {
  args: { field: FIELDS[0]!, value: null, onChange: () => undefined },
  render: () => <Playground />,
};

/** Errors replace the description under each field and say what to do. */
export const WithErrors: Story = {
  args: { field: FIELDS[0]!, value: null, onChange: () => undefined },
  render: () => (
    <Playground
      errors={{
        title: 'Title is required',
        quantity: 'Use a whole number',
        device: 'Pick one of the options',
        extras: 'Pick at most 2',
        urgent: 'Confirm it is urgent',
      }}
    />
  ),
};

/** Read-only for a role that may see but not edit. */
export const Disabled: Story = {
  args: {
    field: { key: 'budget', label: 'Budget', kind: 'money', currency: 'EUR' },
    value: { amountMinor: 129_900, currency: 'EUR' },
    onChange: () => undefined,
    disabled: true,
  },
};
