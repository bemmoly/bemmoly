import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Avatar } from '../avatar/avatar.tsx';
import { AvatarStack } from '../avatar/avatar-stack.tsx';
import { Badge } from '../badge/badge.tsx';
import { KeyChip } from '../key-chip/key-chip.tsx';
import { Dropdown } from '../menu/dropdown-button.tsx';
import { MenuItem } from '../menu/menu-item.tsx';
import { StatusBadge } from '../status-badge/status-badge.tsx';
import { Tag } from '../tag/tag.tsx';
import { PriorityGlyph, TypeGlyph } from './glyphs.tsx';

const meta = { title: 'Components/Board vocabulary', component: TypeGlyph } satisfies Meta<
  typeof TypeGlyph
>;

export default meta;

type Story = StoryObj<typeof meta>;

const PEOPLE = [
  { id: 'PN', name: 'Priya N.', hue: 'green' },
  { id: 'AK', name: 'Aisha K.', hue: 'orange' },
  { id: 'JM', name: 'Jonas M.', hue: 'violet' },
  { id: 'RS', name: 'Rohan S.', hue: 'accent' },
  { id: 'LT', name: 'Lena T.', hue: 'pink' },
] as const;

/** TypeGlyph, KeyChip, PriorityGlyph, Tag, Avatar: the footer of a board card. */
export const CardFooter: Story = {
  args: { type: 'story' },
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 776, y: 402, w: 238, h: 96, note: 'PLT-204 card' }],
  },
  render: () => (
    <div className="flex w-59.5 flex-col gap-2 rounded-control border border-ac bg-sf px-2.5 pt-2.5 pb-2 shadow-ring">
      <div className="text-13 leading-card">Session store migration to Postgres</div>
      <div className="flex gap-1">
        <Tag>auth</Tag>
        <Tag>infra</Tag>
      </div>
      <div className="flex items-center gap-1.5 pt-0.5">
        <TypeGlyph type="story" />
        <KeyChip issueKey="PLT-204" />
        <PriorityGlyph priority="highest" />
        <span className="ml-auto flex items-center gap-1.5">
          <Badge variant="count" className="min-w-5 justify-center">
            5
          </Badge>
          <Avatar name="Aisha K." initials="AK" hue="orange" />
        </span>
      </div>
    </div>
  ),
};

export const AllGlyphs: Story = {
  args: { type: 'story' },
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <TypeGlyph type="story" />
        <TypeGlyph type="bug" />
        <TypeGlyph type="task" />
        <TypeGlyph type="story" size={16} />
        <TypeGlyph type="bug" size={16} />
        <TypeGlyph type="task" size={16} />
      </div>
      <div className="flex items-center gap-4">
        {(['highest', 'high', 'medium', 'low'] as const).map((p) => (
          <PriorityGlyph key={p} priority={p} showLabel />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <KeyChip issueKey="PLT-204" />
        <KeyChip issueKey="PLT-204" size="md" />
        <KeyChip issueKey="PLT-204" inline typeClassName="bg-ok" href="#plt-204">
          <StatusBadge category="review" size="xs" />
        </KeyChip>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone="ok">ACTIVE</Badge>
        <Badge tone="accent">RECOMMENDED</Badge>
        <Badge tone="warn">WIP limit</Badge>
        <Badge tone="outline">locked</Badge>
        <Badge variant="count" tone="solid">
          4
        </Badge>
        <Badge variant="count">3</Badge>
        <Tag size="md">Platform</Tag>
        <Tag size="lg" onRemove={() => {}}>
          priya@acmelabs.dev
        </Tag>
        <Tag tone="accent">Platform Core</Tag>
      </div>
    </div>
  ),
};

/** AvatarStack as the Board's assignee filter, beside a Dropdown filter and quick filters. */
export const FilterRow: Story = {
  args: { type: 'story' },
  parameters: {
    mock: [{ file: 'Bemmoly Board.dc.html', x: 256, y: 228, w: 740, h: 80, note: 'filters' }],
  },
  render: function Render() {
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (id: string) =>
      setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    return (
      <div className="flex items-center gap-2 bg-bg p-2">
        <AvatarStack
          label="Filter by assignee"
          people={PEOPLE}
          size={30}
          total={14}
          ring="bg"
          selected={selected}
          onToggle={toggle}
        />
        <Dropdown label="Epic" widthClassName="w-55">
          <MenuItem onSelect={() => {}}>Auth service</MenuItem>
          <MenuItem onSelect={() => {}}>Billing v2</MenuItem>
        </Dropdown>
        <Dropdown label="Type" widthClassName="w-55">
          <MenuItem onSelect={() => {}}>Story</MenuItem>
        </Dropdown>
      </div>
    );
  },
};
