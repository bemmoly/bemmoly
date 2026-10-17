import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { DeliverySpark } from './delivery-spark.tsx';

describe('DeliverySpark', () => {
  it('draws one bar per period in tokens, read as its label', async () => {
    const { container } = render(
      <DeliverySpark values={[0, 2, 4]} label="6 deploys to Prod in 3 weeks" />,
    );
    await expectAccessible(container);
    screen.getByRole('img', { name: '6 deploys to Prod in 3 weeks' });
    const bars = container.querySelectorAll('rect');
    expect(bars).toHaveLength(3);
    expect(bars[0]?.getAttribute('fill')).toBe('var(--line)');
    expect(bars[2]?.getAttribute('fill')).toBe('var(--acc-500)');
    expect(Number(bars[2]?.getAttribute('height'))).toBeGreaterThan(
      Number(bars[1]?.getAttribute('height')),
    );
  });
});
