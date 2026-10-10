import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { FieldLayoutHeader, FieldLayoutRow, FormGrid, FormGridItem } from './form-layout/index.ts';
import { PriorityGlyph, TypeGlyph } from './glyphs/index.ts';
import {
  ActivityItem,
  CommentComposer,
  ComposerPlaceholder,
  ChecklistBlock,
  CriteriaRow,
  FieldList,
  HistoryItem,
  PropertyEmpty,
  PropertyGroup,
  PropertyRow,
  PropertyValue,
  SaveState,
  FieldPerson,
  FieldRow,
  LinkedIssueRow,
  ListCard,
  ListGroupLabel,
  ReactionChip,
  SectionHeading,
  SubtaskRow,
  WatcherList,
} from './issue-sections/index.ts';
import {
  RuleRow,
  StatusNode,
  StatusPill,
  TransitionEdge,
  TransitionLabel,
  TransitionRow,
  WorkflowCanvas,
  WorkflowLegend,
} from './workflow-canvas/index.ts';

const AK = { name: 'Aisha K.', initials: 'AK', hue: 'orange' } as const;

describe('issue page components', () => {
  it('renders subtasks, links, criteria, activity and the field sidebar accessibly', async () => {
    const onChecked = vi.fn();
    const onReact = vi.fn();
    const { container } = render(
      <div>
        <SectionHeading title="Subtasks" hint="1 of 2 done" />
        <ListCard>
          <SubtaskRow
            issueKey="PLT-204a"
            title="Schema"
            done
            status={{ category: 'done' }}
            assignee={AK}
          />
          <ListGroupLabel>blocks</ListGroupLabel>
          <LinkedIssueRow
            href="#plt-211"
            issueKey="PLT-211"
            title="Cleanup job"
            type="story"
            status={{ category: 'todo' }}
          />
          <CriteriaRow checked={false} onCheckedChange={onChecked}>
            p95 under 8 ms
          </CriteriaRow>
        </ListCard>
        <CommentComposer viewer={AK}>
          <ComposerPlaceholder hint="M" />
        </CommentComposer>
        <ActivityItem
          person={AK}
          verb="commented"
          when="3 hours ago"
          reactions={<ReactionChip emoji="👍" count={2} reacted onToggle={onReact} />}
        >
          Backfill finished.
        </ActivityItem>
        <ActivityItem person={AK} verb="logged 4h" when="Wednesday" />
        <FieldList>
          <FieldRow label="Assignee">
            <FieldPerson {...AK} />
          </FieldRow>
          <FieldRow label="Priority">
            <PriorityGlyph priority="lowest" showLabel />
          </FieldRow>
          <FieldRow label="Watchers">
            <WatcherList people={[AK]} total={6} />
          </FieldRow>
        </FieldList>
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByText('Schema').className).toContain('line-through');
    expect(screen.getByRole('link', { name: /PLT-211/ }).getAttribute('href')).toBe('#plt-211');
    fireEvent.click(screen.getByRole('checkbox', { name: 'p95 under 8 ms' }));
    expect(onChecked).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(onReact).toHaveBeenCalled();
    expect(screen.getByText('logged 4h · Wednesday')).toBeTruthy();
    expect(screen.getByRole('group', { name: '6 watching' })).toBeTruthy();
    expect(screen.getByText('Lowest')).toBeTruthy();
  });

  it('draws the rail groups, the checklist block, history lines and the saved state', async () => {
    const onRetry = vi.fn();
    const { container, rerender } = render(
      <div>
        <PropertyGroup title="Planning">
          <PropertyRow label="Due date">
            <PropertyValue aria-label="Due date: none. Change">
              <PropertyEmpty>Add date</PropertyEmpty>
            </PropertyValue>
          </PropertyRow>
        </PropertyGroup>
        <ChecklistBlock title="Acceptance criteria" done={1} total={2} hint="Checks to tick">
          <CriteriaRow checked>One</CriteriaRow>
          <CriteriaRow checked={false}>Two</CriteriaRow>
        </ChecklistBlock>
        <HistoryItem person={AK} when="2h ago">
          moved the issue
        </HistoryItem>
        <SaveState state="error" onRetry={onRetry} />
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('region', { name: 'Planning' })).toBeTruthy();
    expect(screen.getByText('Add date')).toBeTruthy();
    expect(screen.getByLabelText('1 of 2 met').textContent).toBe('1 / 2');
    expect(screen.queryByText('Checks to tick')).toBeNull();
    expect(screen.getByText('moved the issue')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<SaveState state="saved" />);
    expect(screen.getByRole('status').textContent).toBe('Saved');
  });

  it("lays out create form fields and the type's field table", async () => {
    const onRequired = vi.fn();
    const { container } = render(
      <div>
        <FormGrid>
          <FormGridItem full>Summary</FormGridItem>
          <FormGridItem>Priority</FormGridItem>
        </FormGrid>
        <FieldLayoutHeader />
        <FieldLayoutRow
          name="Summary"
          type="text"
          tag="system"
          required
          requiredLocked
          onCard={false}
        />
        <FieldLayoutRow
          name="Story points"
          type="number"
          tag="ai-filled"
          help="Suggests from similar past issues"
          required={false}
          onRequiredChange={onRequired}
          onCard
          onMore={() => {}}
        />
        <TypeGlyph type="incident" size={36} />
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('switch', { name: 'Summary required' }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Story points required' }));
    expect(onRequired).toHaveBeenCalledWith(true);
    expect(screen.getByText('AI-filled')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Incident' }).getAttribute('width')).toBe('36');
  });
});

describe('settings components', () => {
  it('draws the workflow canvas with a selected node', async () => {
    const onPick = vi.fn();
    const { container } = render(
      <div>
        <WorkflowCanvas
          label="Software workflow"
          edges={<TransitionEdge d="M0 0 L 10 10" highlighted />}
        >
          <StatusNode
            name="Code review"
            category="progress"
            colorClassName="bg-epic-2"
            count={2}
            x="50%"
            y="50%"
            selected
            onClick={onPick}
          />
          <StatusNode name="Done" category="done" count={9} x="80%" y="50%" />
          <TransitionLabel x="65%" y="50%" highlighted>
            Approve
          </TransitionLabel>
          <WorkflowLegend />
        </WorkflowCanvas>
        <TransitionRow onMore={() => {}}>Testing (Approve)</TransitionRow>
        <RuleRow kind="validator">Reviewer field is not empty</RuleRow>
        <StatusPill name="Backlog" category="todo" count={42} block />
      </div>,
    );
    await expectAccessible(container);
    const node = screen.getByRole('button', { name: /Code review/ });
    expect(node.getAttribute('aria-pressed')).toBe('true');
    expect(node.className).toContain('shadow-ring-node');
    fireEvent.click(node);
    expect(onPick).toHaveBeenCalled();
    expect(container.querySelector('path[marker-end="url(#workflow-arrow-ac)"]')).toBeTruthy();
    expect(screen.getByText('VALIDATOR').className).toContain('bg-st-qa-bg');
  });
});
