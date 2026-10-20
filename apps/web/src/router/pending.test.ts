import { describe, expect, it } from 'vitest';
import { PageBodyPending, PagePending } from '../components/page-pending.tsx';
import { createAppRouter } from '../router.tsx';
import { testQueryClient } from '../test/render.tsx';

const router = createAppRouter(testQueryClient());
const routes = Object.values(router.routesById);
const underApp = (id: string) => id.startsWith('/app/');
const lazy = (component: unknown) =>
  typeof (component as { preload?: unknown } | undefined)?.preload === 'function';

describe('a page that is still loading', () => {
  it('shows its pending state shortly after the click, so a fast page never flashes it', () => {
    expect(router.options.defaultPendingMs).toBeLessThanOrEqual(200);
    expect(router.options.defaultPendingMinMs).toBeGreaterThan(0);
  });

  it('draws a skeleton for every lazy page in the frame, never the page it is leaving', () => {
    const lazyPages = routes.filter((route) => underApp(route.id) && lazy(route.options.component));
    expect(lazyPages.length).toBeGreaterThan(10);
    for (const route of lazyPages) {
      expect(route.options.pendingComponent, route.id).toBeDefined();
    }
  });

  it('keeps the settings frame up and waits only in the body between settings pages', () => {
    const settingsPages = routes.filter(
      (route) => route.id.startsWith('/app/settings/') && route.id !== '/app/settings/$',
    );
    const bodies = settingsPages.filter((route) => lazy(route.options.component));
    expect(bodies.length).toBeGreaterThan(0);
    for (const route of bodies)
      expect(route.options.pendingComponent, route.id).toBe(PageBodyPending);
    expect(router.routesById['/app/settings'].options.pendingComponent).toBe(PagePending);
  });
});
