import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../testing/a11y.ts';
import { BulkBar } from './bulk-bar/index.ts';
import { EpicItem, EpicPanel } from './epic-panel/index.ts';
import { FilterBar, FilterChipButton, GroupSwitch } from './filter-bar/index.ts';
import { IssueCard, cardStripe, epicColor, epicFill } from './issue-card/index.ts';
import { IssueCreateRow, IssueRow } from './issue-row/index.ts';
import { KanbanCell, KanbanColumnHeader, KanbanColumnHeaders } from './kanban-column/index.ts';
import { CapacityBar, MetricSparkline, MetricTile } from './metric-tile/index.ts';
import { ProgressBar } from './progress-bar/index.ts';
import { SprintContainer, SprintHeader } from './sprint-header/index.ts';
import { Swimlane, SwimlaneHeader } from './swimlane/index.ts';

const AK = { name: 'Aisha K.', initials: 'AK', hue: 'orange' } as const;

describe('board components', () => {
  it('lays out the lane grid, shows WIP and selects cards from the keyboard', async () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    const { container } = render(
      <div>
        <KanbanColumnHeaders columns={2}>
          <KanbanColumnHeader name="To do" stage="todo" count={7} onAdd={onAdd} />
          <KanbanColumnHeader name="In progress" stage="progress" count={4} wipLimit={4} />
        </KanbanColumnHeaders>
        <Swimlane
          id="lane"
          columns={2}
          open
          header={
            <SwimlaneHeader
              name="Auth service"
              laneKey="PLT-180"
              meta="9 issues · 26 pts"
              progress={19}
              due="Due Oct 7"
              colorClassName={epicFill('epic-2')}
              open
              onToggle={onToggle}
              controls="lane"
            />
          }
        >
          <KanbanCell label="To do, Auth service">
            <IssueCard
              issueKey="PLT-219"
              title="Remove legacy cookie path"
              type="task"
              priority="low"
              blockedBy="PLT-204"
              estimate={2}
              subtasks={{ done: 1, total: 3 }}
              doc="RFC"
              assignee={AK}
              stripeClassName={cardStripe('priority', { priority: 'low', type: 'task' })}
              onSelect={onSelect}
            />
            <IssueCard
              issueKey="PLT-241"
              title="Structured logging"
              type="story"
              priority="high"
              assignee={null}
            />
          </KanbanCell>
          <KanbanCell label="In progress, Auth service" dropping />
        </Swimlane>
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByLabelText('WIP limit 4').className).toContain('bg-amber-50');
    fireEvent.click(screen.getByRole('button', { name: 'New issue in To do' }));
    expect(onAdd).toHaveBeenCalled();
    expect(
      screen
        .getByRole('progressbar', { name: 'Auth service progress' })
        .getAttribute('aria-valuenow'),
    ).toBe('19');
    fireEvent.click(screen.getByRole('button', { name: /Auth service/ }));
    expect(onToggle).toHaveBeenCalled();
    const card = screen.getByRole('button', { name: /Remove legacy cookie path/ });
    expectFocusRing(card);
    expect(card.className).toContain('border-l-green');
    expect(screen.getByText('Blocked by PLT-204')).toBeTruthy();
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('1 of 3 subtasks done')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Unassigned' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'In progress, Auth service' }).className).toContain(
      'outline-dashed',
    );
  });

  it('keeps an epic the same colour wherever it is drawn', () => {
    expect(epicColor('epic-3', 'any')).toBe('epic-3');
    expect(epicColor(null, 'b6f0…')).toBe(epicColor(null, 'b6f0…'));
    expect(epicColor('#ff0000', 'x')).toMatch(/^epic-[1-8]$/);
  });

  it('draws the filter bar with removable chips and a group switch', async () => {
    const onRemove = vi.fn();
    const onSearch = vi.fn();
    const onGroup = vi.fn();
    const { container } = render(
      <div>
        <FilterBar
          search={{ value: '', onChange: onSearch, label: 'Filter this board' }}
          applied={[
            { id: 'mine', label: 'Only mine', description: 'Assigned to me', onRemove },
            { id: 'bug', label: 'Bug', description: 'Type is Bug', onRemove },
          ]}
          onClearAll={() => {}}
          filterMenu={<FilterChipButton icon="filter">Filter</FilterChipButton>}
          group={
            <GroupSwitch
              value="epic"
              onChange={onGroup}
              options={[
                { value: 'epic', label: 'Epic' },
                { value: 'none', label: 'None' },
              ]}
            />
          }
        />
        <MetricTile label="Velocity" value="14/23 pts">
          <ProgressBar value={61} size="md" label="Sprint progress" />
        </MetricTile>
        <MetricTile label="Flow" value="18%" valueTone="ok" childrenFirst>
          <MetricSparkline values={[50, 100]} label="Throughput" />
        </MetricTile>
        <CapacityBar committed={27} capacity={22} label="Capacity" />
      </div>,
    );
    await expectAccessible(container);
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Assigned to me' }));
    expect(onRemove).toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter this board' }), {
      target: { value: 'auth' },
    });
    expect(onSearch).toHaveBeenCalledWith('auth');
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    expect(onGroup).toHaveBeenCalledWith('none');
    expect(screen.getByRole('button', { name: 'Clear' })).toBeTruthy();
  });
});

describe('backlog components', () => {
  it('renders a sprint with its rows, the epics rail and the bulk bar accessibly', async () => {
    const onAction = vi.fn();
    const onCheck = vi.fn();
    const onClear = vi.fn();
    const { container } = render(
      <div>
        <EpicPanel onCreate={() => {}}>
          <EpicItem
            name="Auth service"
            epicKey="PLT-180"
            colorClassName={epicFill('epic-1')}
            progress={61}
            meta="9 issues"
            selected
            onSelect={() => {}}
          />
        </EpicPanel>
        <SprintContainer
          id="s14"
          open
          header={
            <SprintHeader
              name="Sprint 14"
              kind="active"
              dates="Sep 23 – Oct 7"
              goal="Auth in production"
              issueCount={2}
              points={{ done: 9, doing: 11, total: 48 }}
              action="Complete"
              onAction={onAction}
              onMore={() => {}}
              open
              onToggle={() => {}}
              controls="s14"
            />
          }
        >
          <IssueRow
            issueKey="PLT-204"
            title="Session store migration"
            type="story"
            priority="highest"
            status={{ stage: 'review' }}
            epic={{ name: 'Auth service', color: 'epic-1' }}
            estimate={5}
            assignee={AK}
            checked
            onCheck={onCheck}
          />
          <IssueRow
            issueKey="PLT-241"
            title="Structured logging"
            type="story"
            priority="high"
            status={{ stage: 'todo' }}
            blockedBy="PLT-204"
          />
          <IssueCreateRow onCreate={() => {}} />
        </SprintContainer>
        <BulkBar count={1} onClear={onClear}>
          <FilterChipButton>Assign</FilterChipButton>
        </BulkBar>
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('button', { name: /^Auth service/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByRole('img', { name: '9 of 48 points done, 11 in progress' })).toBeTruthy();
    const box = screen.getByRole('checkbox', { name: 'Select PLT-204' });
    expect(box.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(box);
    expect(onCheck).toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Unassigned' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Blocked by PLT-204' })).toBeTruthy();
    expect(screen.getByRole('toolbar', { name: '1 issue selected' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalled();
  });
});
