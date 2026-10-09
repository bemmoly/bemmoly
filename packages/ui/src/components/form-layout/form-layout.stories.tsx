import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { Card } from '../card/card.tsx';
import { Field } from '../input/field.tsx';
import { Input } from '../input/input.tsx';
import { Textarea } from '../textarea/textarea.tsx';
import {
  FieldLayoutHeader,
  FieldLayoutRow,
  FormGrid,
  FormGridItem,
  RequiredMark,
  type FieldTag,
} from './form-layout.tsx';

const meta = { title: 'Components/FormLayout', component: FieldLayoutRow } satisfies Meta<
  typeof FieldLayoutRow
>;

export default meta;

type Story = StoryObj<typeof meta>;

interface FieldSpec {
  name: string;
  type: string;
  required: boolean;
  onCard: boolean;
  tag?: FieldTag;
  help?: string;
}

const FIELDS: FieldSpec[] = [
  { name: 'Summary', type: 'text', required: true, onCard: false, tag: 'system' },
  { name: 'Description', type: 'rich text', required: false, onCard: false, tag: 'system' },
  { name: 'Assignee', type: 'user', required: false, onCard: true },
  { name: 'Priority', type: 'select', required: true, onCard: true },
  {
    name: 'Linked docs',
    type: 'doc link',
    required: false,
    onCard: true,
    tag: 'ai-filled',
    help: 'Suggests related pages from the description',
  },
  {
    name: 'Story points',
    type: 'number',
    required: false,
    onCard: true,
    tag: 'ai-filled',
    help: 'Suggests from similar past issues',
  },
];

/** The Story type's fields table from the Workflow mock's "Issue types and fields" view. */
export const FieldsTable: Story = {
  args: { name: 'Summary', type: 'text', required: true, onCard: false },
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Workflow.dc.html', x: 576, y: 144, w: 508, h: 400, note: 'fields' }],
  },
  render: function Render() {
    const [rows, setRows] = useState(FIELDS.map((f) => ({ ...f })));
    const update = (i: number, patch: Partial<{ required: boolean; onCard: boolean }>) =>
      setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
    return (
      <div className="w-145 bg-bg">
        <Card>
          <FieldLayoutHeader />
          {rows.map((row, i) => (
            <FieldLayoutRow
              key={row.name}
              {...row}
              requiredLocked={row.tag === 'system'}
              onRequiredChange={(required) => update(i, { required })}
              onCardChange={(onCard) => update(i, { onCard })}
              onMore={() => {}}
            />
          ))}
          <div className="flex gap-3.5 px-3.5 py-2.5 text-12h font-medium text-ac">
            <span>+ Add existing field</span>
            <span>+ Create custom field</span>
          </div>
        </Card>
      </div>
    );
  },
};

/** A create form laid out from a type's layout: full-width rows and paired fields 14px apart. */
export const CreateForm: Story = {
  args: { name: 'Summary', type: 'text', required: true, onCard: false },
  parameters: { mock: undefined },
  render: () => (
    <form
      className="flex w-140 flex-col gap-4 rounded-card border border-br bg-sf p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <FormGrid>
        <FormGridItem full>
          <Field
            label={
              <>
                Summary
                <RequiredMark />
              </>
            }
          >
            <Input required placeholder="What needs doing?" />
          </Field>
        </FormGridItem>
        <FormGridItem full>
          <Field label="Description">
            <Textarea rows={3} />
          </Field>
        </FormGridItem>
        <FormGridItem>
          <Field
            label={
              <>
                Priority
                <RequiredMark />
              </>
            }
          >
            <Input required defaultValue="Medium" />
          </Field>
        </FormGridItem>
        <FormGridItem>
          <Field label="Story points" hint="Suggested from similar past issues">
            <Input mono defaultValue="3" />
          </Field>
        </FormGridItem>
      </FormGrid>
      <div className="flex justify-end gap-2">
        <Button>Cancel</Button>
        <Button variant="primary" type="submit">
          Create Story
        </Button>
      </div>
    </form>
  ),
};
