import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Dropdown } from '../menu/dropdown-button.tsx';
import { MenuItem } from '../menu/menu-item.tsx';
import { QuickFilterChip, QuickFilterRow } from './quick-filter.tsx';

const meta = {
  title: 'Components/QuickFilter',
  component: QuickFilterChip,
  args: { active: false, onToggle: () => {}, children: 'Only my issues' },
} satisfies Meta<typeof QuickFilterChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const FILTERS = ['Only my issues', 'Recently updated', 'Blocked'];

/** The Board's filter row after the Label dropdown: three quick filters, one on. */
export const FilterRow: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 256, y: 231, w: 784, h: 90, note: 'filters' }],
  },
  render: function Render() {
    const [on, setOn] = useState<string[]>(['Blocked']);
    const toggle = (name: string) =>
      setOn((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]));
    return (
      <div className="flex items-center gap-2 bg-bg px-3 py-2">
        <Dropdown label="Label" widthClassName="w-55">
          <MenuItem onSelect={() => {}}>auth</MenuItem>
        </Dropdown>
        <QuickFilterRow label="Quick filters" divider>
          {FILTERS.map((name) => (
            <QuickFilterChip key={name} active={on.includes(name)} onToggle={() => toggle(name)}>
              {name}
            </QuickFilterChip>
          ))}
        </QuickFilterRow>
      </div>
    );
  },
};
