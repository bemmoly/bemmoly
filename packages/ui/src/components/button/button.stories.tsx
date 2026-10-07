import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Create', variant: 'primary' },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary'] } },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = { args: { variant: 'secondary', children: 'Complete sprint' } };

export const FromTheBoardMock: Story = {
  render: () => (
    <div className="flex items-center gap-2 bg-bg p-4">
      <Button variant="primary">Create</Button>
      <Button>Insights</Button>
      <Button>Complete sprint</Button>
      <Button>Release</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
