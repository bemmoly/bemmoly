import type { Meta, StoryObj } from '@storybook/react-vite';
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
