import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Card, CardHeader } from '../card/card.tsx';
import { PriorityGlyph } from '../glyphs/glyphs.tsx';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';
import { SegmentedControl } from '../segmented-control/segmented-control.tsx';
import { Tag } from '../tag/tag.tsx';
import { ActivityAction, ActivityItem, ReactionChip } from './activity.tsx';
import { CommentComposer, ComposerPlaceholder, ComposerTool } from './comment-composer.tsx';
import { FieldList, FieldPerson, FieldRow, FieldSwatch, WatcherList } from './field-list.tsx';
import { CriteriaRow, LinkedIssueRow, SubtaskRow } from './issue-rows.tsx';
import { IssueSection, ListCard, ListGroupLabel, SectionHeading } from './section.tsx';

const meta = { title: 'Components/IssueSections', component: SectionHeading } satisfies Meta<
  typeof SectionHeading
>;

export default meta;

type Story = StoryObj<typeof meta>;

const TALL = { width: 1440, height: 1500 };
const AK = { name: 'Aisha K.', initials: 'AK', hue: 'orange' } as const;
const JM = { name: 'Jonas M.', initials: 'JM', hue: 'violet' } as const;
const RS = { name: 'Rohan S.', initials: 'RS', hue: 'accent' } as const;

/** Subtasks and linked issues from the Issue page, and the acceptance criteria checklist. */
export const Lists: Story = {
  args: { title: 'Subtasks' },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Issue.dc.html',
        x: 140,
        y: 638,
        w: 776,
        h: 400,
        viewport: TALL,
        note: 'lists',
      },
    ],
  },
  render: function Render() {
    const [done, setDone] = useState([true, true, false]);
    return (
      <div className="flex w-194 flex-col gap-5 bg-bg">
        <IssueSection heading={<SectionHeading title="Subtasks" hint="2 of 4 done" />}>
          <ProgressBar value={50} size="xs" label="Subtasks done" />
          <ListCard>
            <SubtaskRow
              issueKey="PLT-204a"
              title="Schema for sessions table"
              done
              status={{ category: 'done' }}
              assignee={AK}
            />
            <SubtaskRow
              issueKey="PLT-204b"
              title="Dual-write path"
              done
              status={{ category: 'done' }}
              assignee={AK}
            />
            <SubtaskRow
              issueKey="PLT-204c"
              title="Backfill job + verification"
              status={{ category: 'review' }}
              assignee={AK}
            />
            <SubtaskRow
              issueKey="PLT-204d"
              title="Remove Redis fallback"
              status={{ category: 'todo' }}
              assignee={JM}
            />
          </ListCard>
        </IssueSection>
        <IssueSection heading={<SectionHeading title="Linked issues" />}>
          <ListCard>
            <ListGroupLabel>blocks</ListGroupLabel>
            <LinkedIssueRow
              href="#plt-211"
              issueKey="PLT-211"
              title="Session cleanup background job"
              type="story"
              status={{ category: 'todo' }}
            />
            <LinkedIssueRow
              href="#plt-219"
              issueKey="PLT-219"
              title="Remove legacy cookie path from monolith"
              type="task"
              status={{ category: 'todo' }}
            />
            <ListGroupLabel>relates to</ListGroupLabel>
            <LinkedIssueRow
              href="#plt-218"
              issueKey="PLT-218"
              title="Rotate service tokens on every deploy"
              type="story"
              status={{ category: 'progress' }}
            />
          </ListCard>
        </IssueSection>
        <IssueSection heading={<SectionHeading title="Acceptance criteria" hint="2 of 3 met" />}>
          <ListCard>
            {[
              'Zero session loss during cutover',
              'p95 session read under 8 ms from Postgres',
              'Rollback is a flag flip; Redis stays warm for 7 days',
            ].map((text, i) => (
              <CriteriaRow
                key={text}
                checked={done[i] ?? false}
                onCheckedChange={(c) => setDone((d) => d.map((v, j) => (j === i ? c : v)))}
              >
                {text}
              </CriteriaRow>
            ))}
          </ListCard>
        </IssueSection>
      </div>
    );
  },
};

/** The Activity section: the composer, a comment with reactions, a history row and a work log row. */
export const Activity: Story = {
  args: { title: 'Activity' },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Issue.dc.html',
        x: 140,
        y: 1085,
        w: 776,
        h: 380,
        viewport: TALL,
        note: 'activity',
      },
    ],
  },
  render: function Render() {
    const [tab, setTab] = useState('all');
    return (
      <div className="flex w-194 flex-col gap-3 bg-bg">
        <SectionHeading
          title="Activity"
          actions={
            <SegmentedControl
              size="sm"
              aria-label="Activity filter"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'all', label: 'All' },
                { value: 'comments', label: 'Comments' },
                { value: 'history', label: 'History' },
                { value: 'work', label: 'Work log' },
              ]}
            />
          }
        />
        <CommentComposer
          viewer={RS}
          tools={
            <>
              <ComposerTool label="Bold" className="font-semibold">
                B
              </ComposerTool>
              <ComposerTool label="Italic" className="italic">
                I
              </ComposerTool>
              <ComposerTool label="Mention">@</ComposerTool>
              <ComposerTool label="Link">Link</ComposerTool>
              <ComposerTool label="Code">Code</ComposerTool>
            </>
          }
        >
          <ComposerPlaceholder hint="M" />
        </CommentComposer>
        <ActivityItem
          person={AK}
          verb="commented"
          when="3 hours ago"
          reactions={
            <>
              <ReactionChip emoji="👍" count={2} reacted onToggle={() => {}} />
              <ReactionChip emoji="🎉" count={1} onToggle={() => {}} />
            </>
          }
          actions={
            <>
              <ActivityAction>Reply</ActivityAction>
              <ActivityAction>React</ActivityAction>
              <ActivityAction>Create issue from this</ActivityAction>
            </>
          }
        >
          Backfill finished on staging, 0 mismatches across 2.1M rows. Ready for a second pair of
          eyes on #4821.
        </ActivityItem>
        <ActivityItem person={AK} verb="changed status In progress → In review" when="Thursday" />
        <ActivityItem person={AK} verb="logged 4h" when="Wednesday" />
      </div>
    );
  },
};

/** The Details sidebar of the Issue page. */
export const Details: Story = {
  args: { title: 'Details' },
  parameters: {
    mock: [
      {
        file: 'Bemmoly Issue.dc.html',
        x: 941,
        y: 115,
        w: 358,
        h: 430,
        viewport: TALL,
        note: 'sidebar',
      },
    ],
  },
  render: () => (
    <Card className="w-90">
      <CardHeader title="Details" subtle />
      <FieldList>
        <FieldRow label="Assignee">
          <FieldPerson {...AK} />
        </FieldRow>
        <FieldRow label="Reporter">
          <FieldPerson {...RS} />
        </FieldRow>
        <FieldRow label="Reviewers" className="gap-1">
          <FieldPerson {...JM} avatarOnly />
          <FieldPerson {...RS} avatarOnly />
        </FieldRow>
        <FieldRow label="Priority">
          <PriorityGlyph priority="highest" showLabel />
        </FieldRow>
        <FieldRow label="Story points">
          <span className="font-mono">5</span>
        </FieldRow>
        <FieldRow label="Sprint">
          <a href="#sprint">PLT Sprint 14</a>
        </FieldRow>
        <FieldRow label="Epic">
          <FieldSwatch colorClassName="bg-ac" />
          Auth service
        </FieldRow>
        <FieldRow label="Labels" className="gap-1">
          <Tag>auth</Tag>
          <Tag>infra</Tag>
        </FieldRow>
        <FieldRow label="Fix version">v1.3.0</FieldRow>
        <FieldRow label="Due date">
          <span className="text-warn-fg">Oct 7, 2026</span>
        </FieldRow>
        <FieldRow label="Watchers">
          <WatcherList people={[AK, JM, RS]} total={6} />
        </FieldRow>
      </FieldList>
    </Card>
  ),
};
