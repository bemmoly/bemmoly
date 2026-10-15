import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { CheckboxMark } from './checkbox/index.ts';

describe('CheckboxMark', () => {
  it('draws the tick inside an option without putting a control in it', async () => {
    const { container } = render(
      <div role="listbox" aria-label="Projects" aria-multiselectable>
        <div role="option" aria-selected>
          <CheckboxMark checked />
          PLT
        </div>
        <div role="option" aria-selected={false} aria-disabled>
          <CheckboxMark checked={false} disabled />
          FIN
        </div>
      </div>,
    );
    await expectAccessible(container);
    expect(container.querySelector('input')).toBeNull();
    const [ticked, locked] = screen.getAllByRole('option');
    expect(ticked?.querySelector('svg')).not.toBeNull();
    expect(locked?.querySelector('svg')).toBeNull();
    expect(locked?.firstElementChild?.className).toContain('opacity-55');
  });
});
