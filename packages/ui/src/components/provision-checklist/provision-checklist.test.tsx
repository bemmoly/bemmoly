import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { ProvisionChecklist, type ProvisionState } from './provision-checklist.tsx';

const WORDS: Record<ProvisionState, string> = {
  todo: 'Not started',
  current: 'Next',
  working: 'In progress',
  done: 'Done',
  failed: 'Failed',
};

describe('ProvisionChecklist', () => {
  it('marks the current step and shows actions only where something can be done', async () => {
    const { container } = render(
      <ProvisionChecklist
        ariaLabel="Get started"
        stateLabel={(state) => WORDS[state]}
        steps={[
          { key: 'a', title: 'Scan GitHub', state: 'done', action: <button>Scan</button> },
          {
            key: 'b',
            title: 'Connect a cloud',
            state: 'current',
            action: <button>Connect</button>,
          },
          { key: 'c', title: 'Ship', state: 'todo', action: <button>Ship</button> },
        ]}
      />,
    );
    const steps = screen.getAllByRole('listitem');
    expect(steps[1]?.getAttribute('aria-current')).toBe('step');
    expect(steps[0]?.textContent).toContain('Done');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Connect']);
    await expectAccessible(container);
  });
});
