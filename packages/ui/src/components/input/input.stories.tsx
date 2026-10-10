import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './field.tsx';
import { Input, SearchInput } from './input.tsx';

const meta = {
  title: 'Components/Input',
  component: Input,
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SetupForm: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Setup.dc.html', x: 480, y: 433, w: 720, h: 268, note: 'step 1 form' }],
  },
  render: () => (
    <div className="grid w-180 grid-cols-2 gap-3.5 rounded-card border border-line bg-card p-5">
      <Field label="Workspace name">
        <Input size="lg" defaultValue="Acme Labs" />
      </Field>
      <Field label="URL">
        <Input size="lg" mono tone="recessed" defaultValue="bemmoly.acmelabs.internal" />
      </Field>
      <Field label="Your name">
        <Input size="lg" defaultValue="Rohan S." />
      </Field>
      <Field label="Email">
        <Input size="lg" type="email" defaultValue="rohan@acmelabs.dev" />
      </Field>
      <Field
        label="Password"
        className="col-span-2"
        hint="You can switch to SSO in step 3 and keep this as the break-glass login."
      >
        <Input size="lg" type="password" defaultValue="correcthorse" />
      </Field>
    </div>
  ),
};

export const Search: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly People.dc.html', x: 272, y: 140, w: 280, h: 44, note: 'list search' },
      { file: 'Bemmoly Board.dc.html', x: 808, y: 4, w: 316, h: 40, note: 'top bar search' },
    ],
  },
  render: () => (
    <div className="flex flex-col gap-3">
      <SearchInput
        aria-label="Search people"
        placeholder="Search by name or email"
        wrapperClassName="w-65"
      />
      <SearchInput
        aria-label="Search"
        tone="subtle"
        hint="/"
        placeholder="Search issues, docs, people"
        wrapperClassName="w-75"
      />
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field
      label="SMTP host"
      error="I couldn't reach smtp.acme.dev on port 587. Check the host and try again."
      className="w-90"
    >
      <Input defaultValue="smtp.acme.dev" />
    </Field>
  ),
};
