import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { summary } from '../../test-support.tsx';
import { EmptySpace } from './empty-space.tsx';
import { InReview } from './overview-parts.tsx';

afterEach(cleanup);

describe('an empty space', () => {
  it('offers a blank page first, then a template and an import', () => {
    const onBlank = vi.fn();
    const onImport = vi.fn();
    render(
      <EmptySpace
        spaceName="Research"
        canWrite
        onBlank={onBlank}
        onTemplate={vi.fn()}
        onImport={onImport}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Write the first page in Research' })).toBeTruthy();
    const blank = screen.getByRole('button', { name: /Blank page/ });
    expect(document.activeElement).toBe(blank);
    fireEvent.click(blank);
    fireEvent.click(screen.getByRole('button', { name: /Import/ }));
    expect(onBlank).toHaveBeenCalledOnce();
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('tells a reader they cannot add pages', () => {
    render(
      <EmptySpace
        spaceName="Research"
        canWrite={false}
        onBlank={vi.fn()}
        onTemplate={vi.fn()}
        onImport={vi.fn()}
      />,
    );
    expect(screen.getByText(/You can read Research but not add pages/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('in review', () => {
  it('lists pages waiting on a reviewer and counts the stale ones', () => {
    const old = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString();
    const pages = [
      {
        ...summary('Auth RFC', { status: 'in_review' }),
        lastEditor: null,
        ancestors: [],
        issueKeys: [],
      },
      {
        ...summary('Old policy', { status: 'published', updatedAt: old }),
        lastEditor: null,
        ancestors: [],
        issueKeys: [],
      },
    ];
    render(<InReview pages={pages as never} pending={false} person={() => null} />);
    expect(screen.getByText('Auth RFC')).toBeTruthy();
    expect(screen.getByText('1 page not updated for 90 days')).toBeTruthy();
  });
});
