import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../testing/a11y.ts';
import { BacklogCreateRow, BacklogRow } from './backlog-row/index.ts';
import { EpicItem, EpicPanel } from './epic-panel/index.ts';
import { KanbanCard, cardStripe } from './kanban-card/index.ts';
import { KanbanCell, KanbanColumnHeader, KanbanColumnHeaders } from './kanban-column/index.ts';
import { CapacityBar, MetricSparkline, MetricTile } from './metric-tile/index.ts';
import { ProgressBar } from './progress-bar/index.ts';
import { QuickFilterChip, QuickFilterRow } from './quick-filter/index.ts';
import { SprintContainer, SprintHeader } from './sprint-header/index.ts';
import { Swimlane, SwimlaneHeader } from './swimlane/index.ts';

const AK = { name: 'Aisha K.', initials: 'AK', hue: 'orange' } as const;

describe('board components', () => {
  it('lays out the lane grid, counts WIP and selects cards from the keyboard', async () => {
    const onSelect = vi.fn();
    const onToggle = vi.fn();
    const { container } = render(
      <div>
        <KanbanColumnHeaders columns={2}>
          <KanbanColumnHeader name="To do" count={7} onAdd={() => {}} />
          <KanbanColumnHeader name="In progress" count={5} wipLimit={4} />
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
              open
              onToggle={onToggle}
              controls="lane"
            />
          }
        >
          <KanbanCell label="To do, Auth service">
            <KanbanCard
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
          </KanbanCell>
          <KanbanCell label="In progress, Auth service" dropping />
        </Swimlane>
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByLabelText('5 of 4 allowed').className).toContain('text-warn-fg');
    expect(screen.getByText('WIP limit')).toBeTruthy();
    expect(
      screen
        .getByRole('progressbar', { name: 'Auth service progress' })
        .getAttribute('aria-valuenow'),
    ).toBe('19');
    fireEvent.click(screen.getByRole('button', { name: /Auth service/ }));
    expect(onToggle).toHaveBeenCalled();
    const card = screen.getByRole('button', { name: /Remove legacy cookie path/ });
    expectFocusRing(card);
    expect(card.className).toContain('border-l-ok');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('1 of 3 subtasks done')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'In progress, Auth service' }).className).toContain(
      'border-dashed',
    );
  });

  it('toggles quick filters and reads the metrics strip', async () => {
    const onToggle = vi.fn();
    const { container } = render(
      <div>
        <QuickFilterRow label="Quick filters" divider>
          <QuickFilterChip active onToggle={onToggle}>
            Blocked
          </QuickFilterChip>
        </QuickFilterRow>
        <MetricTile label="Velocity" value="14/23 pts">
          <ProgressBar value={61} size="md" label="Sprint progress" />
        </MetricTile>
        <MetricTile label="Flow" value="▲ 18%" valueTone="ok" childrenFirst>
          <MetricSparkline values={[50, 100]} label="Throughput" />
        </MetricTile>
        <CapacityBar committed={27} capacity={22} label="Capacity" />
      </div>,
    );
    await expectAccessible(container);
    const chip = screen.getByRole('button', { name: 'Blocked' });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalled();
    expect(screen.getByText('27 of 22 pts capacity').className).toContain('text-warn-fg');
    expect(
      screen.getByRole('progressbar', { name: 'Capacity' }).getAttribute('aria-valuenow'),
    ).toBe('100');
  });
});

describe('backlog components', () => {
  it('renders a sprint with its rows and the epic panel accessibly', async () => {
    const onAction = vi.fn();
    const onSelect = vi.fn();
    const { container } = render(
      <div>
        <EpicPanel onCreate={() => {}}>
          <EpicItem
            name="Auth service"
            epicKey="PLT-180"
            colorClassName="bg-ac"
            progress={61}
            meta="9 issues"
            selected
            onSelect={() => {}}
          />
        </EpicPanel>
        <SprintContainer
          id="s14"
          active
          open
          header={
            <SprintHeader
              name="PLT Sprint 14"
              dates="Sep 23 – Oct 7"
              goal="Auth in production"
              active
              issueCount={2}
              counts={{ todo: 1, doing: 1, done: 0 }}
              capacity="23 pts · 14 done"
              action="Complete sprint"
              onAction={onAction}
              onMore={() => {}}
              open
              onToggle={() => {}}
              controls="s14"
            />
          }
        >
          <BacklogRow
            issueKey="PLT-204"
            title="Session store migration"
            type="story"
            priority="highest"
            status={{ category: 'review' }}
            epic={{ name: 'Auth service', colorClassName: 'bg-ac' }}
            estimate={5}
            doc="RFC"
            assignee={AK}
            selected
            onSelect={onSelect}
          />
          <BacklogRow
            issueKey="PLT-241"
            title="Structured logging"
            type="story"
            priority="high"
            status={{ category: 'todo' }}
          />
          <BacklogCreateRow onCreate={() => {}} />
        </SprintContainer>
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('button', { name: /^Auth service/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Complete sprint' }));
    expect(onAction).toHaveBeenCalled();
    expect(screen.getByLabelText('1 in progress').className).toContain('bg-ac-bg');
    fireEvent.keyDown(screen.getByRole('button', { name: /Session store migration/ }), {
      key: ' ',
    });
    expect(onSelect).toHaveBeenCalled();
    expect(screen.getByRole('img', { name: 'Unassigned' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create issue' })).toBeTruthy();
  });
});
