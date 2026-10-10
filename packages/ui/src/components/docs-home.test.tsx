import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { AttentionItem, AttentionList, DocListRow, DocListRowSkeleton } from './doc-list/index.ts';
import { PageStatusPill } from './page-status/index.ts';
import {
  SpaceCard,
  SpaceCardSkeleton,
  SpaceTile,
  spaceInitials,
  spaceTone,
} from './space-card/index.ts';
import { TemplateCard, TemplateChip } from './template-card/index.ts';

describe('Docs home components', () => {
  it('render the home vocabulary accessibly', async () => {
    const { container } = render(
      <main>
        <SpaceCard
          href="/docs/s/ENG"
          name="Engineering"
          tone="accent"
          meta="184 pages"
          project
          pages={['Architecture', '']}
          people={[{ id: 'p', name: 'Priya N.' }]}
        />
        <SpaceCardSkeleton />
        <DocListRow
          href="/docs/p/1"
          title=""
          place="Engineering"
          links="PLT-204"
          person={{ name: 'Priya N.' }}
          when="2h ago"
        />
        <DocListRowSkeleton rows={1} />
        <AttentionList label="Needs attention">
          <AttentionItem tone="warn" meta="since yesterday">
            <b>Review requested</b> on <a href="/docs/p/1">RFC</a>
          </AttentionItem>
        </AttentionList>
        <TemplateChip>Postmortem</TemplateChip>
        <TemplateCard name="Blank page" blank selected />
        <PageStatusPill status="in_review" />
      </main>,
    );
    await expectAccessible(container);
    expect(screen.getByText('PROJECT')).toBeTruthy();
    expect(screen.getAllByText('Untitled')).toHaveLength(2);
    expect(screen.getByText('In review').className).toMatch(/bg-acc-50/);
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/docs/s/ENG', '/docs/p/1', '/docs/p/1']);
  });

  it('chooses a stable tone and initials for a space', () => {
    expect(spaceTone('ENG')).toBe(spaceTone('ENG'));
    expect(spaceTone('ENG', 'violet')).toBe('violet');
    expect(spaceTone('ENG', '#ff0000')).toBe(spaceTone('ENG'));
    expect(spaceInitials('Company handbook')).toBe('CH');
    expect(spaceInitials('engineering')).toBe('EN');
    render(<SpaceTile name="Design" tone="red" size="sm" />);
    // A space never wears a signal colour: the stored 'red' is the palette's rose.
    expect(screen.getByText('DE').className).toMatch(/bg-epic-6/);
    expect(screen.getByText('DE').className).not.toMatch(/bg-red|bg-red/);
  });

  it('marks the chosen template card and reports clicks', () => {
    const onClick = vi.fn();
    render(<TemplateCard name="RFC" description="Design doc" onClick={onClick} />);
    const card = screen.getByRole('button', { name: /RFC/ });
    expect(card.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
