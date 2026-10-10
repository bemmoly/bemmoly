import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppFrame } from './app-frame.tsx';
import { FrameContext, type FrameState } from './frame-context.ts';
import { HeaderActions } from './page-header.tsx';
import { PageLayout } from './page-layout.tsx';
import { SidebarRow } from './sidebar/sidebar-row.tsx';

function widths(phone: boolean, narrow: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: query.includes('767') ? phone : narrow,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

const frame = (patch: Partial<FrameState> = {}): FrameState => ({
  mode: 'full',
  phone: false,
  pathname: '/work/board/PLT',
  navigate: vi.fn(),
  openSheet: vi.fn(),
  toggleSidebar: vi.fn(),
  ...patch,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the app frame', () => {
  const draw = (collapsed: boolean) =>
    render(
      <AppFrame
        pathname="/"
        navigate={() => undefined}
        collapsed={collapsed}
        onCollapsedChange={() => undefined}
        sidebar={<p>sidebar</p>}
        bottomBar={<p>bottom bar</p>}
      >
        <p>page</p>
      </AppFrame>,
    );

  it('shows the full sidebar, the rail when folded or narrow, and a bottom bar on a phone', () => {
    widths(false, false);
    const { container, unmount } = draw(false);
    expect(container.querySelector('[data-sidebar]')?.getAttribute('data-sidebar')).toBe('full');
    unmount();
    widths(false, false);
    expect(draw(true).container.querySelector('[data-sidebar="rail"]')).toBeTruthy();
    cleanup();
    widths(false, true);
    expect(draw(false).container.querySelector('[data-sidebar="rail"]')).toBeTruthy();
    cleanup();
    widths(true, true);
    draw(false);
    expect(screen.getByText('bottom bar')).toBeTruthy();
    expect(screen.queryByText('sidebar')).toBeNull();
  });
});

describe('the page header', () => {
  it('links every crumb, marks the current page and takes a screen’s own actions', () => {
    const state = frame();
    render(
      <FrameContext.Provider value={state}>
        <PageLayout
          layout="full"
          header={{
            crumbs: [
              { label: 'Work', path: '/work/projects' },
              { label: 'Platform Core', path: '/work/board/PLT' },
            ],
            tabs: [{ id: 'board', label: 'Board', icon: 'board', path: '/work/board/PLT' }],
          }}
        >
          <HeaderActions>
            <button type="button">Complete sprint</button>
          </HeaderActions>
        </PageLayout>
      </FrameContext.Provider>,
    );
    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    const links = trail.querySelectorAll('a');
    expect([...links].map((link) => link.getAttribute('href'))).toEqual([
      '/work/projects',
      '/work/board/PLT',
    ]);
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
    fireEvent.click(links[0] as HTMLElement);
    expect(state.navigate).toHaveBeenCalledWith('/work/projects');
    expect(screen.getByRole('link', { name: /Board/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('banner').textContent).toContain('Complete sprint');
    expect(document.title).toBe('Board · Platform Core · Bemmoly');
  });

  it('names the workspace in the tab title of a page with no other context', () => {
    render(
      <FrameContext.Provider value={frame({ pathname: '/inbox', workspaceName: 'Acme Labs' })}>
        <PageLayout layout="full" header={{ crumbs: [{ label: 'Inbox', path: '/inbox' }] }}>
          <p>Items</p>
        </PageLayout>
      </FrameContext.Provider>,
    );
    expect(document.title).toBe('Inbox · Acme Labs · Bemmoly');
  });

  it('keeps only the current crumb on a phone, with the menu button', () => {
    const state = frame({ phone: true });
    render(
      <FrameContext.Provider value={state}>
        <PageLayout
          layout="contained"
          header={{
            crumbs: [
              { label: 'Settings', path: '/settings' },
              { label: 'Teams', path: '/settings/teams' },
            ],
          }}
        >
          <p>content</p>
        </PageLayout>
      </FrameContext.Provider>,
    );
    expect(screen.queryByText('Settings')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(state.openSheet).toHaveBeenCalledOnce();
  });
});

describe('a sidebar row', () => {
  it('is a labelled link with its unread count, a row in full and an icon on the rail', () => {
    const full = render(
      <FrameContext.Provider value={frame({ pathname: '/inbox' })}>
        <SidebarRow label="Inbox" icon="inbox" path="/inbox" pill={4} />
      </FrameContext.Provider>,
    );
    const row = screen.getByRole('link', { name: 'Inbox, 4 unread' });
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(row.textContent).toContain('Inbox');
    full.unmount();
    render(
      <FrameContext.Provider value={frame({ mode: 'rail' })}>
        <SidebarRow label="Inbox" icon="inbox" path="/inbox" pill={4} keys="G I" />
      </FrameContext.Provider>,
    );
    const button = screen.getByRole('link', { name: 'Inbox, 4' });
    expect(button.textContent).toBe('');
    act(() => {
      fireEvent.focus(button);
    });
    expect(screen.getByRole('tooltip').textContent).toContain('Inbox');
  });
});
