import axe from 'axe-core';
import { expect } from 'vitest';

/**
 * Runs axe on a rendered container and fails with the rule ids and targets. Colour contrast is
 * checked in the browser (Storybook), since jsdom computes no styles. Frames are checked as
 * elements (a title, say) but not entered: the test DOM loads nothing into them.
 */
export async function expectAccessible(container: Element): Promise<void> {
  const result = await axe.run(container, {
    iframes: false,
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  const problems = result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(problems).toEqual([]);
}

/** The focus ring every interactive component carries (see lib/focus.ts). */
export function expectFocusRing(el: Element): void {
  expect(el.className).toMatch(/focus-ring/);
}
