import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { GateList, type GateState } from './gate-list.tsx';

const WORDS: Record<GateState, string> = { pass: 'Passed', fail: 'Failed', pending: 'Waiting' };

describe('GateList', () => {
  it('lists each gate with its state in words and its reason', async () => {
    const { container } = render(
      <GateList
        ariaLabel="Gates for Prod"
        stateLabel={(state) => WORDS[state]}
        gates={[
          { key: 'tests', state: 'pass', label: 'Tests and security', reason: '198 tests' },
          { key: 'staging', state: 'fail', label: 'Healthy in Staging', reason: '5xx at 2.4%' },
          { key: 'approvals', state: 'pending', label: 'Approvals, 1 of 3' },
        ]}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Gates for Prod' })).getAllByRole(
      'listitem',
    );
    expect(items.map((item) => item.textContent)).toEqual([
      'Tests and security, Passed198 tests',
      'Healthy in Staging, Failed5xx at 2.4%',
      'Approvals, 1 of 3, Waiting',
    ]);
    expect(items[1]?.dataset['state']).toBe('fail');
    await expectAccessible(container);
  });
});
