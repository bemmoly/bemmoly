import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { id, listed, newClient, providers, startServer } from '../test-support.tsx';
import { BacklinksSection } from './backlinks-section.tsx';

const PAGE = id(800);
const RUNBOOK = id(801);
const ISSUE = id(802);

const issueRecord = {
  kind: 'issue',
  id: ISSUE,
  key: 'PLT-204',
  title: 'Session store migration',
  path: '/work/issue/PLT-204',
};

const { server } = startServer(
  http.get('*/api/v1/docs/pages/:pageId/links', () =>
    HttpResponse.json(
      listed([
        { targetKind: 'issue', targetId: ISSUE, kind: 'embed', page: null, record: issueRecord },
      ]),
    ),
  ),
  http.get('*/api/v1/docs/pages/:pageId/references', () =>
    HttpResponse.json(
      listed([
        {
          ...issueRecord,
          key: 'PLT-218',
          id: id(803),
          title: 'Rotate tokens',
          linkKind: 'mention',
        },
      ]),
    ),
  ),
  http.get('*/api/v1/docs/pages/:pageId/backlinks', () =>
    HttpResponse.json(
      listed([
        {
          pageId: RUNBOOK,
          spaceKey: 'ENG',
          title: 'Session migration runbook',
          icon: null,
          status: 'published',
          kind: 'mention',
        },
        {
          pageId: id(804),
          spaceKey: 'PLAT',
          title: 'Q4 platform plan',
          icon: null,
          status: 'draft',
          kind: 'linked',
        },
      ]),
    ),
  ),
);

const renderSection = () =>
  render(<BacklinksSection pageId={PAGE} />, { wrapper: providers(newClient()) });

describe('the links section', () => {
  it('lists issues referenced, where the page is referenced and its backlinks', async () => {
    renderSection();
    const issues = await screen.findByRole('region', { name: 'Issues referenced' });
    expect(within(issues).getByText('PLT-204')).toBeTruthy();
    expect(within(issues).getByRole('link').getAttribute('href')).toBe('/work/issue/PLT-204');
    const refs = screen.getByRole('region', { name: 'Referenced in' });
    expect(within(refs).getByText('PLT-218')).toBeTruthy();
    expect(within(refs).getByText('Mentioned')).toBeTruthy();
    const backlinks = screen.getByRole('region', { name: 'Backlinks' });
    const runbook = within(backlinks).getByRole('link', { name: /Session migration runbook/ });
    expect(runbook.getAttribute('href')).toBe(`/docs/p/${RUNBOOK}`);
    expect(within(backlinks).getByText('PLAT · Linked here')).toBeTruthy();
  });

  it('says so quietly when nothing links to the page', async () => {
    server.use(
      http.get('*/api/v1/docs/pages/:pageId/links', () => HttpResponse.json(listed([]))),
      http.get('*/api/v1/docs/pages/:pageId/references', () => HttpResponse.json(listed([]))),
      http.get('*/api/v1/docs/pages/:pageId/backlinks', () => HttpResponse.json(listed([]))),
    );
    renderSection();
    expect(await screen.findByText(/Nothing links here yet/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Backlinks' })).toBeNull();
  });
});
