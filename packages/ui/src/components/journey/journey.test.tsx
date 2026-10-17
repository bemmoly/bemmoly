import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { RUN_STATE_WORDS } from '../run-glyph/states.ts';
import { Journey, type JourneyStation } from './journey.tsx';

const STATIONS: JourneyStation[] = [
  { key: 'build', label: 'Build', state: 'passed', detail: '2m' },
  { key: 'staging', label: 'Staging', state: 'passed' },
  { key: 'asia', label: 'Prod asia', state: 'running', detail: '25% canary', live: true },
  { key: 'us', label: 'Prod us', state: 'queued' },
];

const renderJourney = (extra: Partial<Parameters<typeof Journey>[0]> = {}) =>
  render(
    <Journey
      stations={STATIONS}
      progress={0.5}
      ariaLabel="Retry UPI collect, from commit to Prod"
      stateLabel={(state) => RUN_STATE_WORDS[state]}
      {...extra}
    />,
  );

describe('Journey', () => {
  it('lists every station in order with its state in words', async () => {
    const { container } = renderJourney();
    const list = screen.getByRole('list', { name: 'Retry UPI collect, from commit to Prod' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items[2]?.textContent).toContain('Prod asia');
    expect(items[2]?.textContent).toContain('Running');
    expect(items[2]?.textContent).toContain('25% canary');
    await expectAccessible(container);
  });

  it('marks the live station as the current step', () => {
    renderJourney();
    const current = screen
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current'));
    expect(current.map((item) => item.textContent)).toEqual([expect.stringContaining('Prod asia')]);
  });

  it('fills the track to the progress, clamped', () => {
    const { container, rerender } = renderJourney({ progress: 2 });
    const fill = () => (container.querySelector('[data-part="fill"]') as HTMLElement).style.width;
    // Four stations: the track spans 75% of the strip, between the outer glyphs' centres.
    expect(fill()).toBe('calc(75%)');
    rerender(
      <Journey
        stations={STATIONS}
        progress={0.25}
        ariaLabel="x"
        stateLabel={(state) => RUN_STATE_WORDS[state]}
      />,
    );
    expect(fill()).toBe('calc(18.75%)');
  });

  it('drops the details when compact', () => {
    renderJourney({ compact: true });
    expect(screen.queryByText('25% canary')).toBeNull();
    expect(screen.getByText('Prod asia')).toBeTruthy();
  });
});
