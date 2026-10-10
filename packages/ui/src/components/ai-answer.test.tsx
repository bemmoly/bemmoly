import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { AiAnswer, type AiAnswerBlock, type AiAnswerSourceItem } from './ai-surface/index.ts';

const sources: AiAnswerSourceItem[] = [
  { id: 'c1', title: 'RFC: Move sessions', label: 'Rollback', href: '/docs/p/1#rollback' },
  { id: 'c2', title: 'Auth runbook', label: 'Auth runbook', href: '/docs/p/2' },
  { id: 'c3', title: 'Never cited', label: 'Body', href: '/docs/p/3' },
];

const blocks: AiAnswerBlock[] = [
  {
    kind: 'paragraph',
    sentences: [
      { text: 'Flip the flag off.', citations: ['c1'], unsourced: false },
      { text: 'Teams usually flip it back within the hour.', citations: [], unsourced: true },
    ],
  },
  {
    kind: 'item',
    sentences: [{ text: 'Page on-call.', citations: ['c2', 'c1'], unsourced: false }],
  },
];

describe('AiAnswer', () => {
  it('links each citation by number, marks the unsourced claim and lists cited sources', async () => {
    const { container } = render(
      <AiAnswer blocks={blocks} sources={sources} source="from 2 pages" />,
    );
    const answer = screen.getByRole('region', { name: 'AI answer' });
    expect(within(answer).getByText('from 2 pages')).toBeTruthy();
    const first = within(answer).getAllByRole('link', { name: /Source 1: RFC: Move sessions/ });
    expect(first[0]?.getAttribute('href')).toBe('/docs/p/1#rollback');
    expect(within(answer).getByRole('link', { name: /Source 2/ }).textContent).toBe('2');
    expect(within(answer).getAllByText('Unsourced')).toHaveLength(1);
    expect(within(answer).getByText('Sources')).toBeTruthy();
    expect(within(answer).queryByText('Never cited')).toBeNull();
    expect(within(answer).getByText('Auth runbook')).toBeTruthy();
    await expectAccessible(container);
  });

  it('holds the sources and the last sentence’s marker while it streams', () => {
    render(
      <AiAnswer
        streaming
        sources={sources}
        blocks={[
          {
            kind: 'paragraph',
            sentences: [{ text: 'Flip the flag off when errors', citations: [], unsourced: true }],
          },
        ]}
      />,
    );
    const answer = screen.getByRole('region', { name: 'AI answer' });
    expect(answer.getAttribute('aria-busy')).toBe('true');
    expect(within(answer).queryByText('Unsourced')).toBeNull();
    expect(within(answer).queryByText('Sources')).toBeNull();
  });
});
