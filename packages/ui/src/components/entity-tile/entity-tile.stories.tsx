import type { Meta, StoryObj } from '@storybook/react-vite';
import { EntityTile } from './entity-tile.tsx';

const meta = { title: 'Foundations/EntityTile', component: EntityTile } satisfies Meta<
  typeof EntityTile
>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The review's one tile: workspace, project, module and team, at the logo's corner ratio. */
export const Kinds: Story = {
  args: { name: 'Acme Labs' },
  render: () => (
    <div className="flex items-end gap-5 text-11 text-tx-3">
      {[
        { label: 'Workspace', tile: <EntityTile name="Acme Labs" tone="ink" size={32} /> },
        { label: 'Project', tile: <EntityTile name="Platform Core" size={32} /> },
        { label: 'Work', tile: <EntityTile name="Work" tone="work" icon="board" size={32} /> },
        { label: 'Docs', tile: <EntityTile name="Docs" tone="docs" icon="doc" size={32} /> },
        { label: 'AI', tile: <EntityTile name="AI" tone="ai" icon="spark" size={32} /> },
        {
          label: 'Team',
          tile: <EntityTile name="Payments" letter="PA" tone="accent" size={32} />,
        },
      ].map(({ label, tile }) => (
        <span key={label} className="grid justify-items-center gap-1.5">
          {tile}
          {label}
        </span>
      ))}
    </div>
  ),
};

/** Sizes in use: 14 in sidebar section heads, 18 in nav rows, 22 on the rail, 32 in headers. */
export const Sizes: Story = {
  args: { name: 'Mobile App' },
  render: () => (
    <div className="flex items-center gap-3">
      {[14, 18, 22, 32, 36].map((size) => (
        <EntityTile key={size} name="Mobile App" size={size} />
      ))}
    </div>
  ),
};
