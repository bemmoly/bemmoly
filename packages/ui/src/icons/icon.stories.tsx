import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, ICON_NAMES, ICON_SIZE } from './icon.tsx';

const meta = {
  title: 'Foundations/Icons',
  component: Icon,
  args: { name: 'board' },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllIcons: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 8, y: 140, w: 232, h: 460, note: 'sidebar icons' }],
  },
  render: () => (
    <div className="grid w-140 grid-cols-4 gap-2">
      {ICON_NAMES.map((name) => (
        <div
          key={name}
          className="flex items-center gap-2.5 rounded-control bg-sf px-2.5 py-1.75 text-tx4"
        >
          <Icon name={name} />
          <span className="font-mono text-11 text-tx3">{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const SidebarNav: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 8, y: 108, w: 232, h: 190, note: 'planning nav' }],
  },
  render: () => (
    <div className="flex w-56 flex-col gap-px bg-sf p-2 text-tx2">
      {(
        [
          ['roadmap', 'Roadmap'],
          ['backlog', 'Backlog'],
          ['board', 'Board'],
          ['sprint', 'Sprints'],
          ['reports', 'Reports'],
        ] as const
      ).map(([name, label]) => (
        <div
          key={name}
          className={
            name === 'board'
              ? 'flex items-center gap-2.5 rounded-control bg-ac-bg px-2.5 py-1.75 font-medium text-ac'
              : 'flex items-center gap-2.5 rounded-control px-2.5 py-1.75'
          }
        >
          <Icon
            name={name}
            size={ICON_SIZE.bar}
            className={name === 'board' ? 'text-ac' : 'text-tx4'}
          />
          {label}
        </div>
      ))}
    </div>
  ),
};

/** 16px in buttons and rows, 18px in the top bar and sidebar, 14px for carets. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 bg-sf p-4 text-tx2">
      {(Object.entries(ICON_SIZE) as Array<[keyof typeof ICON_SIZE, number]>).map(([use, px]) => (
        <div key={use} className="flex items-center gap-2">
          <Icon name={use === 'caret' ? 'caret' : 'inbox'} size={px} />
          <span className="font-mono text-11 text-tx3">
            {use} · {px}px
          </span>
        </div>
      ))}
    </div>
  ),
};
