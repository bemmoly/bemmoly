import type { Meta, StoryObj } from '@storybook/react-vite';
import { BacklogCreateRow, BacklogRow } from './backlog-row.tsx';

const meta = {
  title: 'Components/BacklogRow',
  component: BacklogRow,
  args: {
    issueKey: 'PLT-204',
    title: 'Session store migration to Postgres',
    type: 'story',
    priority: 'highest',
    status: { category: 'review' },
    epic: { name: 'Auth service', colorClassName: 'bg-ac' },
    estimate: 5,
    doc: 'RFC',
    assignee: { name: 'Aisha K.', initials: 'AK', hue: 'orange' },
  },
} satisfies Meta<typeof BacklogRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Rows from the backlog container: an unassigned issue and the create line. */
export const Rows: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Backlog.dc.html', x: 524, y: 244, w: 892, h: 118, note: 'rows' }],
  },
  render: (args) => (
    <div className="w-223 bg-sf">
      <BacklogRow {...args} onSelect={() => {}} />
      <BacklogRow
        issueKey="PLT-241"
        title="Structured logging across services"
        type="story"
        priority="high"
        status={{ category: 'todo' }}
        epic={{ name: 'Observability', colorClassName: 'bg-sky-fg' }}
        estimate={3}
        selected
        onSelect={() => {}}
      />
      <BacklogCreateRow onCreate={() => {}} />
    </div>
  ),
};
