import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVERY_DOC_NODE, PAGE_ID } from '../testing/doc-fixture.ts';
import { RichTextView } from '../view.tsx';

afterEach(cleanup);

describe('Docs nodes in the read-only view', () => {
  it('draws every node with the pieces the editor uses', () => {
    const { container } = render(<RichTextView doc={EVERY_DOC_NODE} size="doc" />);
    expect(
      container.querySelector('[data-type=callout][data-variant=info]')?.textContent,
    ).toContain('Info');
    expect(screen.getByText('Decided')).toBeTruthy();
    expect(screen.getByText('2026-10-07')).toBeTruthy();
    expect(screen.getByRole('table').querySelectorAll('th')).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'Cutover flow' })).toBeTruthy();
    expect(screen.getByText('Confluence macro: jira-chart')).toBeTruthy();
    expect(screen.getByTitle('PLT-204 (issue details unavailable)')).toBeTruthy();
    expect(screen.getByText('Live issues appear here when Work is enabled.')).toBeTruthy();
  });

  it('anchors headings on a Docs page so the contents link to them', () => {
    const { container } = render(<RichTextView doc={EVERY_DOC_NODE} size="doc" />);
    const contents = screen.getByRole('navigation', { name: 'Contents' });
    const links = [...contents.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#context', '#migration-order', '#owners']);
    for (const href of links) expect(container.querySelector(href!)).toBeTruthy();
  });

  it('leaves headings unanchored elsewhere, as Work printed them', () => {
    const { container } = render(<RichTextView doc={EVERY_DOC_NODE} size="page" />);
    expect(container.querySelector('h2[id]')).toBeNull();
  });

  it('links pages through the host, and draws issues with its renderer', () => {
    const onNavigate = vi.fn();
    render(
      <RichTextView
        doc={EVERY_DOC_NODE}
        size="doc"
        services={{
          pageHref: (id) => `/docs/p/${id}`,
          onNavigate,
          renderIssue: (key) => <span>live {key}</span>,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('link', { name: 'Postmortem: Sep 29 login outage' }));
    expect(onNavigate).toHaveBeenCalledWith(`/docs/p/${PAGE_ID}`);
    expect(screen.getByText('live PLT-204')).toBeTruthy();
  });

  it('prints an image with an unsafe source as its alt text', () => {
    render(
      <RichTextView
        doc={{
          type: 'doc',
          content: [{ type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'Diagram' } }],
        }}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Diagram')).toBeTruthy();
  });
});
