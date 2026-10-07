import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Icon } from '../../icons/icon.tsx';
import { Avatar } from '../avatar/avatar.tsx';
import { Badge } from '../badge/badge.tsx';
import { Button } from '../button/button.tsx';
import { EmptyState } from '../empty-state/empty-state.tsx';
import { Skeleton, SkeletonText } from '../skeleton/skeleton.tsx';
import { Card, CardBody, CardHeader, SelectableCard } from './card.tsx';

const meta = { title: 'Components/Card', component: Card } satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Inbox: Story = {
  parameters: {
    mock: [{ file: 'Bemmoly Home.dc.html', x: 864, y: 254, w: 464, h: 330, note: 'Inbox card' }],
  },
  render: () => (
    <Card className="w-116">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            Inbox
            <Badge variant="count" tone="solid">
              4
            </Badge>
          </span>
        }
        actions={<span className="font-normal text-tx4">Mark all read</span>}
      />
      <div className="flex gap-2.5 border-b border-br-row bg-ac-bg2 px-4 py-2.75 text-12h leading-note">
        <Avatar name="Aisha K." initials="AK" hue="orange" size={26} />
        <div className="flex min-w-0 flex-col gap-0.75">
          <div>
            <b>Aisha K.</b> requested your review on <span className="text-ac">PLT-204</span>
          </div>
          <div className="truncate text-tx3">Backfill finished on staging, 0 mismatches.</div>
          <div className="text-11h text-tx5">3h ago</div>
        </div>
      </div>
    </Card>
  ),
};

export const DetailsPanel: Story = {
  parameters: {
    mock: [
      { file: 'Bemmoly Board.dc.html', x: 1056, y: 534, w: 370, h: 50, note: 'Details header' },
    ],
  },
  render: () => (
    <Card radius="panel" className="w-89">
      <CardHeader subtle title="Details" actions={<Icon name="caret-up" className="text-tx5" />} />
      <CardBody layout="list" className="text-12h">
        Assignee, reporter, priority…
      </CardBody>
    </Card>
  ),
};

export const Selectable: Story = {
  parameters: {
    mock: [
      {
        file: 'Bemmoly Setup.dc.html',
        x: 480,
        y: 300,
        w: 720,
        h: 140,
        note: 'see step 2 and 4 cards',
      },
    ],
  },
  render: function Render() {
    const [value, setValue] = useState('scrum');
    return (
      <div role="radiogroup" aria-label="Method" className="grid w-180 grid-cols-2 gap-2.5">
        {['scrum', 'kanban'].map((id) => (
          <SelectableCard key={id} selected={value === id} onClick={() => setValue(id)}>
            <span className="font-semibold capitalize">{id}</span>
            <span className="text-12h text-tx4">
              {id === 'scrum'
                ? 'Sprints, backlog, velocity and burndown.'
                : 'Continuous flow, WIP limits, cycle time.'}
            </span>
          </SelectableCard>
        ))}
      </div>
    );
  },
};

export const EmptyAndLoading: Story = {
  render: () => (
    <div className="flex gap-4">
      <Card className="w-90">
        <CardHeader title="Recent docs" />
        <EmptyState
          icon={<Icon name="doc" />}
          title="No docs yet"
          description="Pages you create or edit show up here. Start with a page in your team's space."
          action={<Button variant="primary">New page</Button>}
        />
      </Card>
      <Card className="w-90" aria-busy="true">
        <CardHeader title="Your projects" />
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton shape="block" width={30} height={30} />
            <SkeletonText lines={2} className="flex-1" />
          </div>
          <SkeletonText lines={3} />
        </CardBody>
      </Card>
    </div>
  ),
};
