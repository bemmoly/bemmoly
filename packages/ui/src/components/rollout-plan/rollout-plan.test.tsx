import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { RUN_STATE_WORDS } from '../run-glyph/states.ts';
import { RolloutPlan } from './rollout-plan.tsx';

describe('RolloutPlan', () => {
  it('lists the waves in order with their steps and what they wait for', async () => {
    const { container } = render(
      <RolloutPlan
        ariaLabel="Rollout to Prod"
        stateLabel={(state) => RUN_STATE_WORDS[state]}
        waves={[
          {
            key: '1',
            number: 1,
            title: 'asia-south1',
            steps: [
              { key: '5', label: '5%', state: 'passed' },
              { key: '25', label: '25%', state: 'running' },
            ],
            detail: '10 minutes each',
          },
          { key: '2', number: 2, title: 'us-east1', detail: 'after wave 1' },
        ]}
      >
        <p>Roll back by itself</p>
      </RolloutPlan>,
    );
    const waves = within(screen.getByRole('list', { name: 'Rollout to Prod' })).getAllByRole(
      'listitem',
    );
    expect(waves).toHaveLength(2);
    expect(waves[0]?.textContent).toContain('asia-south1');
    expect(waves[0]?.textContent).toContain('25%');
    expect(screen.getByRole('img', { name: 'Running' })).toBeTruthy();
    expect(screen.getByText('Roll back by itself')).toBeTruthy();
    await expectAccessible(container);
  });
});
