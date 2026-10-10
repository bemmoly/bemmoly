import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Card, CardHeader } from '../card/card.tsx';
import {
  PAGE_STATUS_LABELS,
  PageStatusPill,
  type PageStatus,
} from '../page-status/page-status.tsx';
import { SpaceCard, SpaceCardSkeleton } from '../space-card/space-card.tsx';
import { Tabs } from '../tabs/tabs.tsx';
import { TemplateCard, TemplateChip } from '../template-card/template-card.tsx';
import { AttentionItem, AttentionList } from './attention-list.tsx';
import { DocListRow, DocListRowSkeleton } from './doc-list-row.tsx';

const meta = {
  title: 'Docs/Home',
  component: DocListRow,
  args: {
    href: '#',
    title: 'Auth service RFC',
    place: 'Engineering / Architecture',
    links: 'PLT-204, PLT-218',
    person: { name: 'Priya N.', hue: 'green' },
    when: '2h ago',
  },
} satisfies Meta<typeof DocListRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The Recent / Starred / Drafts card. */
export const RecentList: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Docs.dc.html', x: 160, y: 728, w: 674, h: 300, note: 'recent' }],
  },
  render: function Render(args) {
    const [tab, setTab] = useState<'recent' | 'starred' | 'drafts'>('recent');
    return (
      <Card className="m-4 w-170">
        <div className="border-b border-br2 px-4">
          <Tabs
            size="sm"
            bordered={false}
            value={tab}
            onChange={setTab}
            items={[
              { value: 'recent', label: 'Recent' },
              { value: 'starred', label: 'Starred' },
              { value: 'drafts', label: 'Drafts' },
            ]}
          />
        </div>
        <DocListRow {...args} />
        <DocListRow
          href="#"
          title="Q4 billing roadmap"
          place="Product"
          links="PLT-150"
          person={{ name: 'Rohan S.', hue: 'accent' }}
          when="Friday"
        />
        <DocListRow
          href="#"
          title="Sprint 14 retro notes"
          icon="📝"
          place="Platform Core"
          person={{ name: 'Jonas M.', hue: 'violet' }}
          when="Thursday"
        />
        <DocListRowSkeleton rows={2} />
      </Card>
    );
  },
};

export const Spaces: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Docs.dc.html', x: 160, y: 330, w: 1120, h: 380, note: 'spaces' }],
  },
  render: () => (
    <div className="grid w-280 grid-cols-3 gap-3 bg-bg p-4">
      <SpaceCard
        href="#"
        name="Engineering"
        tone="accent"
        meta="184 pages"
        pages={['Architecture', 'Runbooks', 'Postmortems']}
        people={[
          { id: 'pn', name: 'Priya N.', hue: 'green' },
          { id: 'ak', name: 'Aisha K.', hue: 'orange' },
          { id: 'jm', name: 'Jonas M.', hue: 'violet' },
        ]}
      />
      <SpaceCard
        href="#"
        name="Platform Core"
        tone="green"
        meta="31 pages · linked to PLT"
        project
        pages={['Sprint notes', 'Decision log', 'Auth service RFC']}
      />
      <SpaceCardSkeleton />
    </div>
  ),
};

export const NeedsAttentionAndTemplates: Story = {
  parameters: {
    layout: 'fullscreen',
    mock: [{ file: 'Bemmoly Docs.dc.html', x: 854, y: 728, w: 426, h: 420, note: 'right column' }],
  },
  render: () => (
    <div className="flex w-110 flex-col gap-5 bg-bg p-4">
      <Card>
        <CardHeader title="Needs attention" />
        <AttentionList>
          <AttentionItem tone="warn" meta="Jonas, waiting since yesterday">
            <b>Review requested</b> on <a href="#">Auth service RFC</a>
          </AttentionItem>
          <AttentionItem tone="caution" meta="You own it. Check it still holds.">
            <b>Stale:</b> <a href="#">On-call escalation policy</a> last edited 14 months ago
          </AttentionItem>
        </AttentionList>
      </Card>
      <Card>
        <CardHeader title="Templates" />
        <div className="grid grid-cols-2 gap-1.5 px-4 py-2.5">
          {['RFC / design doc', 'Meeting notes', 'Postmortem', 'Product spec'].map((name) => (
            <TemplateChip key={name}>{name}</TemplateChip>
          ))}
        </div>
      </Card>
    </div>
  ),
};

export const PickerCards: Story = {
  render: () => (
    <div className="grid w-160 grid-cols-2 gap-2 bg-sf p-4">
      <TemplateCard blank name="Blank page" description="Start from an empty page." selected />
      <TemplateCard
        name="RFC / design doc"
        category="Engineering"
        description="Context, proposal, alternatives and rollout, with owner and reviewers."
      />
    </div>
  ),
};

export const StatusPills: Story = {
  render: () => (
    <div className="flex gap-2 bg-sf p-4">
      {(Object.keys(PAGE_STATUS_LABELS) as PageStatus[]).map((status) => (
        <PageStatusPill key={status} status={status} />
      ))}
    </div>
  ),
};
