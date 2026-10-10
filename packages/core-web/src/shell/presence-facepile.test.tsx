import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameContext, type FrameState } from './frame-context.ts';
import { HeaderPresence } from './page-header.tsx';
import { PageLayout } from './page-layout.tsx';
import { PresenceFacepile, type PresencePerson } from './presence-facepile.tsx';

const frame = (phone: boolean): FrameState => ({
  mode: 'full',
  phone,
  pathname: '/work/board/PLT',
  navigate: vi.fn(),
  openSheet: vi.fn(),
  toggleSidebar: vi.fn(),
});

const person = (name: string, where = 'on the board'): PresencePerson => ({
  id: name,
  name,
  where,
});

afterEach(cleanup);

describe('the presence facepile', () => {
  it('draws nothing when the person is alone', () => {
    const { container } = render(<PresenceFacepile people={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows three faces and counts the rest, each named with where they are', () => {
    const people = ['Priya N.', 'Aisha K.', 'Jonas M.', 'Lena T.', 'Maya K.'].map((name) =>
      person(name),
    );
    people[0] = person('Priya N.', 'viewing PLT-204');
    render(<PresenceFacepile people={people} />);
    const group = screen.getByRole('group');
    expect(group.getAttribute('aria-label')).toBe(
      'Also here: Priya N. · viewing PLT-204, Aisha K. · on the board, Jonas M. · on the board, ' +
        'Lena T. · on the board, Maya K. · on the board',
    );
    const faces = screen.getAllByRole('img');
    expect(faces.map((face) => face.getAttribute('aria-label'))).toEqual([
      'Priya N.',
      'Aisha K.',
      'Jonas M.',
      '2 more: Lena T., Maya K.',
    ]);
    // The tooltip replaces the native title, so the name never shows twice.
    expect(faces[0]?.getAttribute('title')).toBe('');
    fireEvent.focus(faces[0] as HTMLElement);
    expect(screen.getByRole('tooltip').textContent).toBe('Priya N. · viewing PLT-204');
    expect(faces[3]?.textContent).toBe('+2');
  });
});

describe('header presence', () => {
  const page = (phone: boolean) =>
    render(
      <FrameContext.Provider value={frame(phone)}>
        <PageLayout layout="full" header={{ crumbs: [{ label: 'Board', path: '/work/board' }] }}>
          <HeaderPresence>
            <PresenceFacepile people={[person('Priya N.')]} />
          </HeaderPresence>
          <p>Board</p>
        </PageLayout>
      </FrameContext.Provider>,
    );

  it('is drawn in the header on a wide screen', () => {
    page(false);
    const banner = screen.getByRole('banner');
    expect(banner.querySelector('[data-presence]')).toBeTruthy();
  });

  it('is left out on a phone', () => {
    page(true);
    expect(document.querySelector('[data-presence]')).toBeNull();
    expect(screen.getByText('Board', { selector: 'p' })).toBeTruthy();
  });
});
