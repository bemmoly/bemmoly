import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import {
  AiBrief,
  AiInsightBar,
  AiSuggestion,
  AiSummary,
  AiActionButton,
  AiNotUseful,
} from './ai-surface/index.ts';
import { Avatar, AvatarStack, initialsOf } from './avatar/index.ts';
import { Badge } from './badge/index.ts';
import { Card, CardBody, CardHeader } from './card/index.ts';
import { EmptyState } from './empty-state/index.ts';
import { PriorityGlyph, TypeGlyph } from './glyphs/index.ts';
import { KeyChip } from './key-chip/index.ts';
import { Logo, WorkspaceMark } from './logo/index.ts';
import { Skeleton, SkeletonText } from './skeleton/index.ts';
import { StatusBadge, StatusButton } from './status-badge/index.ts';
import { Table } from './table/index.ts';
import { Tag } from './tag/index.ts';

describe('display components', () => {
  it('render the board card vocabulary accessibly', async () => {
    const { container } = render(
      <div>
        <TypeGlyph type="story" />
        <KeyChip issueKey="PLT-204" />
        <PriorityGlyph priority="highest" />
        <PriorityGlyph priority="low" showLabel />
        <Tag>auth</Tag>
        <Tag onRemove={() => {}}>priya@acmelabs.dev</Tag>
        <Badge tone="ok">ACTIVE</Badge>
        <StatusBadge category="review" />
        <StatusButton category="progress" />
        <Avatar name="Aisha K." hue="orange" />
        <AvatarStack
          label="Filter by assignee"
          people={[
            { id: 'pn', name: 'Priya N.' },
            { id: 'ak', name: 'Aisha K.' },
          ]}
          total={11}
          onToggle={() => {}}
          selected={['pn']}
        />
        <Skeleton />
        <SkeletonText />
      </div>,
    );
    await expectAccessible(container);
    expect(screen.getByRole('img', { name: 'Highest priority' })).toBeTruthy();
    expect(screen.getByText('In review').className).toContain('bg-st-rev-bg');
    expect(screen.getByRole('button', { name: 'Priya N.' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByLabelText('9 more')).toBeTruthy();
  });

  it('derives initials', () => {
    expect(initialsOf('Rohan Sharma')).toBe('RS');
    expect(initialsOf('rohan@acmelabs.dev')).toBe('RO');
  });

  it('renders the logo from the brand files and follows the theme accent', () => {
    render(<Logo variant="lockup" />);
    const logo = screen.getByRole('img', { name: 'Bemmoly' });
    expect(logo.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(logo.getAttribute('style')).toContain('--brand-mark-bg: var(--ac-fill)');
    // The CSP refuses inline style attributes, so the themed fills arrive as classes.
    expect(logo.innerHTML).not.toContain('style=');
    expect(logo.querySelector('.brand-mark-bg')).not.toBeNull();
    expect(logo.querySelector('.brand-mark-fg')).not.toBeNull();
    expect(logo.className).toContain('[&_.brand-mark-bg]:fill-(--brand-mark-bg)');
    render(<WorkspaceMark name="Acme Labs" />);
    expect(screen.getByRole('img', { name: 'Acme Labs' }).textContent).toBe('A');
  });

  it('renders cards, empty states and AI surfaces accessibly', async () => {
    const dismiss = vi.fn();
    const accept = vi.fn();
    const { container } = render(
      <div>
        <Card>
          <CardHeader title="Inbox" actions={<a href="#all">Mark all read</a>} />
          <CardBody>
            <EmptyState
              title="Nothing needs you"
              description="When someone mentions you, it shows here."
            />
          </CardBody>
        </Card>
        <AiSummary
          source="from 14 comments, 2 PRs"
          actions={
            <>
              <AiActionButton>Ping Jonas</AiActionButton>
              <AiNotUseful />
            </>
          }
        >
          Backfill verified on staging.
        </AiSummary>
        <AiInsightBar title="Sprint risk" onDismiss={dismiss}>
          PLT-204 blocks 2 issues.
        </AiInsightBar>
        <AiBrief title="Your morning brief">Two things need you today.</AiBrief>
        <AiSuggestion onAccept={accept} onDismiss={dismiss}>
          Move PLT-211 and PLT-219 to Sprint 15.
        </AiSuggestion>
      </div>,
    );
    await expectAccessible(container);
    fireEvent.click(screen.getByRole('button', { name: 'Do it' }));
    expect(accept).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0] as HTMLElement);
    expect(dismiss).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Not useful' })).toBeTruthy();
  });
});

describe('Table', () => {
  const rows = [
    { id: 'rs', name: 'Rohan S.', role: 'Org admin' },
    { id: 'pn', name: 'Priya N.', role: 'Project admin' },
  ];
  const columns = [
    {
      key: 'person',
      header: 'Person',
      width: 'minmax(0,1.4fr)',
      render: (r: (typeof rows)[number]) => r.name,
    },
    {
      key: 'role',
      header: 'Org role',
      width: '150px',
      render: (r: (typeof rows)[number]) => r.role,
    },
  ];

  it('lays out grid tracks, opens rows from the keyboard and loads the next page', async () => {
    const onRowClick = vi.fn();
    const onLoadMore = vi.fn();
    const { container } = render(
      <Table
        label="Users"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        footer={{ summary: 'Showing 2 of 42', hasMore: true, onLoadMore }}
      />,
    );
    await expectAccessible(container);
    expect(screen.getAllByRole('row')[0]?.getAttribute('style')).toContain('minmax(0,1.4fr) 150px');
    fireEvent.keyDown(screen.getAllByRole('row')[2] as HTMLElement, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
