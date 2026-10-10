import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../icons/icon.tsx';
import { Button } from '../button/button.tsx';
import { IconButton } from '../button/icon-button.tsx';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';
import { CapacityBar, MetricSparkline, MetricTile } from './metric-tile.tsx';

const meta = {
  title: 'Components/MetricTile',
  component: MetricTile,
  args: { label: 'Velocity', value: '14/23 pts' },
} satisfies Meta<typeof MetricTile>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The Scrum board header: the velocity tile before Insights and Complete sprint. */
export const Velocity: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 536, y: 83, w: 504, h: 48, note: 'actions' }],
  },
  render: () => (
    <div className="flex items-center gap-2 bg-bg p-2">
      <MetricTile label="Velocity" value="14/23 pts">
        <ProgressBar value={61} size="md" label="Sprint progress" className="w-20" />
      </MetricTile>
      <Button>Insights</Button>
      <Button>Complete sprint</Button>
      <IconButton label="More" icon="more" variant="secondary" />
    </div>
  ),
};

/** The Kanban board header: the flow sparkline and its trend. */
export const Flow: Story = {
  parameters: { mock: undefined },
  render: () => (
    <div className="flex items-center gap-2 bg-bg p-2">
      <MetricTile
        label="Flow"
        value={
          <span className="inline-flex items-center gap-0.5">
            <Icon name="arrow-up" size={11} label="up" />
            18%
          </span>
        }
        valueTone="ok"
        childrenFirst
      >
        <MetricSparkline values={[50, 70, 45, 85, 100, 65, 80]} label="Throughput, last 7 weeks" />
      </MetricTile>
      <Button>Insights</Button>
      <Button>Release</Button>
    </div>
  ),
};

/** The Backlog sprint header's capacity line, under and over capacity. */
export const Capacity: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Backlog.dc.html', x: 1030, y: 652, w: 400, h: 40, note: 'Sprint 15' }],
  },
  render: () => (
    <div className="flex flex-col gap-3 bg-sf p-3">
      <CapacityBar committed={19} capacity={22} label="Sprint 15 capacity" />
      <CapacityBar committed={27} capacity={22} label="Sprint 16 capacity" />
    </div>
  ),
};
