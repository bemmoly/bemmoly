import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Button } from '../button/button.tsx';
import { Menu } from '../menu/menu.tsx';
import { MenuItem } from '../menu/menu-item.tsx';
import { FilterBar, FilterChipButton, GroupSwitch } from './filter-bar.tsx';

const meta = {
  title: 'Components/FilterBar',
  component: FilterBar,
} satisfies Meta<typeof FilterBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The review's bar: search, "Only mine" set, Filter, Saved views, Group and Display. */
export const Board: Story = {
  args: { search: { value: '', onChange: () => undefined, label: 'Filter issues' }, applied: [] },
  render: function Render() {
    const [text, setText] = useState('');
    const [mine, setMine] = useState(true);
    const [group, setGroup] = useState<'epic' | 'assignee' | 'none'>('epic');
    return (
      <div className="w-300 bg-canvas">
        <FilterBar
          search={{ value: text, onChange: setText, label: 'Filter this board' }}
          applied={
            mine
              ? [
                  {
                    id: 'mine',
                    label: 'Only mine',
                    description: 'Assigned to me',
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
                Only mine
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
