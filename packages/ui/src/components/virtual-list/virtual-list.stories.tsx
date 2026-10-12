import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { cx } from '../../lib/cx.ts';
import { VirtualList, type VirtualRange } from './virtual-list.tsx';

const meta = { title: 'Components/VirtualList', component: VirtualList } satisfies Meta<
  typeof VirtualList
>;

export default meta;

type Story = StoryObj<typeof meta>;

const NAMES = ['Atlas', 'Beacon', 'Cobalt', 'Delta', 'Ember', 'Fjord', 'Granite', 'Harbor'];

/** 1,240 rows at 44px; only the rows in view (plus four either side) are in the page. */
export const ManyRows: Story = {
  args: { count: 1240, rowHeight: 44, height: 396, renderRow: () => null },
  render: function Render(args) {
    const [range, setRange] = useState<VirtualRange>({ start: 0, end: 0 });
    const [active, setActive] = useState(0);
    return (
      <div className="flex w-160 flex-col gap-2">
        <p className="m-0 text-12 text-tx-3 tabular-nums">
          Rows {range.start + 1} to {range.end} of {args.count} in view
        </p>
        <VirtualList
          {...args}
          role="listbox"
          aria-label="Projects"
          tabIndex={0}
          aria-activedescendant={`row-${active}`}
          onRangeChange={setRange}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') setActive((n) => Math.min(args.count - 1, n + 1));
            if (event.key === 'ArrowUp') setActive((n) => Math.max(0, n - 1));
          }}
          className="rounded-card bg-card shadow-e1 focus-ring"
          renderRow={(index, style) => (
            <div
              key={index}
              id={`row-${index}`}
              role="option"
              aria-selected={index === active}
              style={style}
              className={cx(
                'flex items-center gap-3 border-b border-line-2 px-4 text-13 text-tx',
                index === active && 'bg-acc-50',
              )}
            >
              <span className="w-12 font-mono text-12 text-tx-2">P{index + 1}</span>
              {NAMES[index % NAMES.length]} {index + 1}
            </div>
          )}
        />
      </div>
    );
  },
};
