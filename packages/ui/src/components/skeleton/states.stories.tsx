import type { Meta, StoryObj } from '@storybook/react-vite';
import { RelativeTime } from '../relative-time/relative-time.tsx';
import { SkeletonCard, SkeletonHeader, SkeletonRow } from './skeleton-shapes.tsx';

const meta = { title: 'Foundations/States', component: SkeletonRow } satisfies Meta<
  typeof SkeletonRow
>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Skeletons with the final layout's heights: a header, list rows and board cards. */
export const Skeletons: Story = {
  render: () => (
    <div aria-busy="true" className="flex w-180 flex-col bg-canvas">
      <SkeletonHeader tabs={4} />
      {Array.from({ length: 4 }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
      <div className="grid grid-cols-3 gap-2.5 bg-sunken p-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  ),
};

const NOW = new Date('2026-10-10T12:00:00Z');

/** Hover a time for the date and time it stands for. */
export const RelativeTimes: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5 text-13 text-tx-2">
      {[
        '2026-10-10T11:59:40Z',
        '2026-10-10T11:12:00Z',
        '2026-10-10T07:00:00Z',
        '2026-10-09T15:00:00Z',
        '2026-10-06T10:00:00Z',
        '2026-07-01T10:00:00Z',
      ].map((iso) => (
        <RelativeTime key={iso} iso={iso} now={NOW} />
      ))}
    </div>
  ),
};
