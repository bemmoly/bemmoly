import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ISSUE_TYPES,
  PRIORITIES,
  PriorityGlyph,
  StatusGlyph,
  statusStage,
  TypeGlyph,
  typeLook,
  type IssueType,
  type Priority,
  type StatusStage,
} from './glyphs.tsx';

/** Text a glyph draws besides its <title>: there must be none, every mark is a shape. */
const drawnText = (svg: Element) =>
  [...svg.childNodes]
    .filter((node) => node.nodeName !== 'title')
    .map((node) => node.textContent)
    .join('');

describe('TypeGlyph', () => {
  it.each(Object.keys(ISSUE_TYPES) as IssueType[])(
    'draws %s as a tile with no characters',
    (key) => {
      render(<TypeGlyph type={key} size={20} />);
      const svg = screen.getByRole('img', { name: ISSUE_TYPES[key].name });
      const tile = svg.querySelector('rect');
      expect(tile?.getAttribute('fill')).toBe(`var(--${ISSUE_TYPES[key].color})`);
      expect(tile?.getAttribute('rx')).toBe('4.8');
      expect(drawnText(svg)).toBe('');
    },
  );

  it('keeps a built-in type on its fixed colour whatever the first release stored', () => {
    const look = typeLook({ key: 'epic', name: 'Epic', icon: '◆', color: '#8b5cf6' });
    expect(look).toMatchObject({ color: 'type-epic', mark: { icon: 'zap', filled: true } });
  });

  it('draws a custom type with its stored icon, in the nearest type colour', () => {
    render(<TypeGlyph type={{ key: 'ops', name: 'Ops', icon: 'rocket', color: '#0f9fb5' }} />);
    const svg = screen.getByRole('img', { name: 'Ops' });
    expect(svg.querySelector('rect')?.getAttribute('fill')).toBe('var(--type-subtask)');
    expect(svg.querySelectorAll('svg')).toHaveLength(1);
  });

  it('falls back on the level look when a custom type stored a character or nothing', () => {
    expect(typeLook({ key: 'initiative', level: 'epic', icon: '▮' })).toMatchObject({
      name: 'initiative',
      color: 'type-epic',
      mark: { icon: 'zap' },
    });
    expect(typeLook({ key: 'chore', level: 'standard', icon: null, color: null }).color).toBe(
      'type-task',
    );
  });
});

describe('PriorityGlyph', () => {
  const inked = (svg: Element) =>
    [...svg.querySelectorAll('rect')].filter((r) => r.getAttribute('fill') === 'var(--tx-2)')
      .length;

  it.each([
    ['high', 3],
    ['medium', 2],
    ['low', 1],
    ['lowest', 0],
  ] as [Priority, number][])('draws %s with %i of three bars inked', (priority, bars) => {
    render(<PriorityGlyph priority={priority} />);
    const svg = screen.getByRole('img', { name: `${PRIORITIES[priority].name} priority` });
    expect(inked(svg)).toBe(bars);
    expect(svg.querySelectorAll('rect')).toHaveLength(3);
  });

  it('spends red only on the most urgent level', () => {
    const { container } = render(
      <>
        <PriorityGlyph priority="highest" />
        <PriorityGlyph priority="high" />
      </>,
    );
    const fills = [...container.querySelectorAll('[fill]')].map((el) => el.getAttribute('fill'));
    expect(fills.filter((fill) => fill === 'var(--red)')).toHaveLength(1);
  });

  it('draws no priority as three dashes and names it', () => {
    render(<PriorityGlyph priority={null} showLabel />);
    expect(screen.getByText('No priority')).toBeTruthy();
  });
});

describe('StatusGlyph', () => {
  it.each([
    ['backlog', 'var(--todo)'],
    ['todo', 'var(--todo)'],
    ['progress', 'var(--prog)'],
    ['review', 'var(--prog)'],
    ['qa', 'var(--prog)'],
    ['done', 'var(--done)'],
    ['wont', 'var(--todo)'],
  ] as [StatusStage, string][])('colours %s by its category', (stage, color) => {
    const { container } = render(<StatusGlyph stage={stage} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.querySelector('circle')?.outerHTML).toContain(color);
    expect(drawnText(svg)).toBe('');
  });

  it('dashes the backlog ring and fills further as work moves right', () => {
    const { container } = render(
      <>
        <StatusGlyph stage="backlog" />
        <StatusGlyph stage="todo" />
        <StatusGlyph stage="review" />
      </>,
    );
    const [backlog, todo, review] = [...container.querySelectorAll('svg')];
    expect(backlog?.querySelector('circle')?.getAttribute('stroke-dasharray')).toBeTruthy();
    expect(todo?.querySelector('path')).toBeNull();
    expect(review?.querySelector('path')?.getAttribute('d')).toContain('A3.4 3.4 0 0 1');
  });

  it('maps the server categories and status names onto stages', () => {
    expect(statusStage('todo', 'Backlog')).toBe('backlog');
    expect(statusStage('todo', 'Selected')).toBe('todo');
    expect(statusStage('in_progress', 'Code review')).toBe('review');
    expect(statusStage('in_progress', 'Testing')).toBe('qa');
    expect(statusStage('in_progress', 'Doing')).toBe('progress');
    expect(statusStage('done', 'Done')).toBe('done');
    expect(statusStage('done', "Won't do")).toBe('wont');
  });

  it('takes the status name for assistive tech', () => {
    render(<StatusGlyph stage="review" label="Code review" />);
    expect(screen.getByRole('img', { name: 'Code review' })).toBeTruthy();
  });
});
