import type { Meta, StoryObj } from '@storybook/react-vite';
import { DeliverySpark } from './delivery-spark.tsx';

const meta = {
  title: 'Pipelines/DeliverySpark',
  component: DeliverySpark,
  args: {
    values: [6, 9, 7, 12, 10, 14, 9, 11, 13, 8, 12, 15],
    label: '126 deploys to Prod in 12 weeks',
  },
} satisfies Meta<typeof DeliverySpark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Busy: Story = {};

export const BusyDark: Story = { globals: { mode: 'dark' } };

export const Quiet: Story = {
  args: { values: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 1], label: '4 deploys to Prod in 12 weeks' },
};

export const Never: Story = {
  args: { values: Array.from({ length: 12 }, () => 0), label: 'No deploys to Prod in 12 weeks' },
};

/** A catalog page of rows: plain SVG, nothing animates. */
export const ManyRows: Story = {
  render: () => (
    <div className="grid grid-cols-6 gap-3">
      {Array.from({ length: 120 }, (_, row) => (
        <DeliverySpark
          key={row}
          label={`Row ${row}`}
          values={Array.from({ length: 12 }, (_, week) => ((row * 7 + week * 5) % 13) - 3)}
        />
      ))}
    </div>
  ),
};
