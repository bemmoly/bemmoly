import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { Menu } from '../menu/menu.tsx';
import { MenuItem } from '../menu/menu-item.tsx';
import { FilterBar, FilterChipButton, GroupSwitch } from './filter-bar.tsx';
import { QuickFilters } from './quick-filters.tsx';

const meta = {
  title: 'Components/FilterBar',
  component: FilterBar,
} satisfies Meta<typeof FilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The review's bar: search, the quick filters as toggles ("Only my issues" on, two more behind
 * "+2 more"), the Epic filter set, Filter, Saved views, Group and Display.
 */
export const Board: Story = {
  args: { search: { value: '', onChange: () => undefined, label: 'Filter issues' }, applied: [] },
  render: function Render() {
    const [text, setText] = useState('');
    const [mine, setMine] = useState(true);
    const [quick, setQuick] = useState<string[]>(['Only my issues']);
    const toggle = (label: string) =>
      setQuick((on) => (on.includes(label) ? on.filter((x) => x !== label) : [...on, label]));
    const [group, setGroup] = useState<'epic' | 'assignee' | 'none'>('epic');
    return (
      <div className="w-300 bg-canvas">
        <FilterBar
          search={{ value: text, onChange: setText, label: 'Filter this board' }}
          quickFilters={
            <QuickFilters
              filters={[
                'Only my issues',
                'Recently updated',
                'Blocked',
                'Bugs',
                'Needs design',
                'Flaky',
              ].map((label) => ({
                id: label,
                label,
                pressed: quick.includes(label),
                onToggle: () => toggle(label),
              }))}
            />
          }
          applied={
            mine
              ? [
                  {
                    id: 'epic',
                    label: 'Checkout',
                    description: 'Epic is Checkout',
                    onRemove: () => setMine(false),
                  },
                ]
              : []
          }
          filterMenu={
            <Menu
              trigger={(props) => (
                <FilterChipButton icon="filter" {...props}>
                  Filter
                </FilterChipButton>
              )}
            >
              <MenuItem onSelect={() => setMine(true)} checked={mine}>
                Checkout
              </MenuItem>
            </Menu>
          }
          savedViews={<FilterChipButton icon="star">Saved views</FilterChipButton>}
          group={
            <GroupSwitch
              value={group}
              onChange={setGroup}
              options={[
                { value: 'epic', label: 'Epic' },
                { value: 'assignee', label: 'Assignee' },
                { value: 'none', label: 'None' },
              ]}
            />
          }
          display={<Button size="sm">Display</Button>}
        />
      </div>
    );
  },
};
