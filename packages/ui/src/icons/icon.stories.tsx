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
          className="flex items-center gap-2.5 rounded-control bg-card px-2.5 py-1.75 text-tx-3"
        >
          <Icon name={name} />
          <span className="font-mono text-11 text-tx-2">{name}</span>
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
    <div className="flex w-56 flex-col gap-px bg-card p-2 text-tx-2">
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
              ? 'flex items-center gap-2.5 rounded-control bg-acc-50 px-2.5 py-1.75 font-medium text-acc'
              : 'flex items-center gap-2.5 rounded-control px-2.5 py-1.75'
          }
        >
          <Icon
            name={name}
            size={ICON_SIZE.bar}
            className={name === 'board' ? 'text-acc' : 'text-tx-3'}
          />
          {label}
        </div>
      ))}
    </div>
  ),
};

/** 16px in buttons, rows and carets, 18px in the top bar and sidebar, 14px in small controls. */
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-6 bg-card p-4 text-tx-2">
      {(Object.entries(ICON_SIZE) as Array<[keyof typeof ICON_SIZE, number]>).map(([use, px]) => (
        <div key={use} className="flex items-center gap-2">
          <Icon name={use === 'small' ? 'caret' : 'inbox'} size={px} />
          <span className="font-mono text-11 text-tx-2">
            {use} · {px}px
          </span>
        </div>
      ))}
    </div>
  ),
};
