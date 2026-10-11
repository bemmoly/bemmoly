import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../icons/icon.tsx';
import { Button } from './button.tsx';
import { IconButton } from './icon-button.tsx';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Create', variant: 'primary', size: 'md' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg', 'bar'] },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const FromTheBoardMock: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 604, y: 0, w: 92, h: 48, note: 'top bar Create' },
      { file: 'Bemmoly Board.dc.html', x: 764, y: 84, w: 268, h: 44, note: 'page header' },
      { file: 'Bemmoly Board.dc.html', x: 1056, y: 150, w: 384, h: 46, note: 'drawer actions' },
    ],
  },
  render: () => (
    <div className="flex flex-col gap-4 bg-sunken p-3">
      <div className="flex h-topbar items-center bg-card px-2">
        <Button variant="primary" size="bar">
          Create
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button>Insights</Button>
        <Button>Complete sprint</Button>
        <IconButton label="More" icon="more" variant="secondary" />
      </div>
      <div className="flex items-center gap-1.5 bg-card p-2">
        <Button size="sm">Attach</Button>
        <Button size="sm">Link doc</Button>
        <Button size="sm">Subtask</Button>
      </div>
    </div>
  ),
};

export const Sizes: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Setup.dc.html', x: 380, y: 760, w: 440, h: 70, note: 'large, step footer' },
    ],
  },
  render: () => (
    <div className="flex flex-col items-start gap-3">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex items-center gap-2">
          <Button variant="primary" size={size}>
            Create admin and continue
          </Button>
          <Button size={size}>Skip for now</Button>
          <Button variant="ghost" size={size}>
            Not useful
          </Button>
          <span className="text-11 text-tx-3">{size}</span>
        </div>
      ))}
    </div>
  ),
};

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="primary" iconEnd={<Icon name="enter" className="ml-0.5 opacity-75" />}>
        Run 3 changes
      </Button>
      <Button iconEnd={<Icon name="caret" className="text-tx-3" />}>Epic</Button>
      <Button variant="primary" loading>
        Saving
      </Button>
      <Button disabled>Disabled</Button>
      <Button variant="danger">Delete project</Button>
    </div>
  ),
};

export const IconButtons: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 1268, y: 0, w: 132, h: 48, note: 'top bar' }],
  },
  render: () => (
    <div className="flex h-topbar items-center gap-2 bg-card px-2">
      <IconButton label="Inbox" icon="inbox" badge={4} />
      <IconButton label="Help" icon="help" />
      <IconButton label="Settings" icon="settings" />
      <IconButton label="More" icon="more" size="xs" />
      <IconButton label="Close" icon="close" size="xs" />
    </div>
  ),
};
