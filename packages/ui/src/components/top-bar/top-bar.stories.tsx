import type { Meta, StoryObj } from '@storybook/react-vite';
import { MenuItem } from '../menu/menu-item.tsx';
import { CreateMenuEmpty, CreateMenuItem } from './create-menu.tsx';
import { TopBar } from './top-bar.tsx';

const noop = () => {};

const meta = {
  title: 'Components/TopBar',
  component: TopBar,
  args: {
    nav: [
      { id: 'work', label: 'Your work', href: '#work' },
      { id: 'projects', label: 'Projects', href: '#projects', active: true },
      { id: 'docs', label: 'Docs', href: '#docs' },
      { id: 'filters', label: 'Filters', href: '#filters' },
      { id: 'dashboards', label: 'Dashboards', href: '#dashboards' },
      { id: 'teams', label: 'Teams', href: '#teams' },
    ],
    onCreate: noop,
    onSearch: noop,
    onAsk: noop,
    inboxCount: 4,
    onInbox: noop,
    onHelp: noop,
    onSettings: noop,
    user: { name: 'Rohan S.', initials: 'RS' },
  },
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Board.dc.html', x: 0, y: 0, w: 1440, h: 48, note: 'top bar' }],
  },
} satisfies Meta<typeof TopBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FromTheBoardMock: Story = {
  render: (args) => (
    <div className="w-360">
      <TopBar {...args} />
    </div>
  ),
};

export const WithoutAi: Story = {
  args: { onAsk: undefined, onHelp: undefined, onSettings: undefined },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Appearance Settings.dc.html',
        x: 0,
        y: 0,
        w: 1440,
        h: 48,
        note: 'settings top bar',
      },
    ],
  },
  render: (args) => (
    <div className="w-360">
      <TopBar {...args} />
    </div>
  ),
};

/** Create with something to make: icon, label, one line and the Command mock's shortcut. */
export const CreateMenu: Story = {
  args: {
    onCreate: undefined,
    createMenu: (
      <>
        <CreateMenuItem
          icon="board"
          label="Issue"
          description="A bug, story or task in a project"
          shortcut="Mod+N"
          onSelect={noop}
        />
        <CreateMenuItem
          icon="doc"
          label="Doc"
          description="A page in a docs space"
          onSelect={noop}
        />
      </>
    ),
  },
  render: (args) => (
    <div className="h-60 w-360">
      <TopBar {...args} />
    </div>
  ),
};

/** Create while no enabled module makes anything; admins get the way to Settings › Modules. */
export const CreateEmpty: Story = {
  args: {
    onCreate: undefined,
    createMenu: (
      <CreateMenuEmpty
        title="Nothing to create yet"
        description="Create fills up once a module that makes things, such as issues or docs, is enabled."
        action={<MenuItem onSelect={noop}>Open Settings › Modules</MenuItem>}
      />
    ),
  },
  render: (args) => (
    <div className="h-60 w-360">
      <TopBar {...args} />
    </div>
  ),
};
