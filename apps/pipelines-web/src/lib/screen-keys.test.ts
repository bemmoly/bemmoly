import { describe, expect, it } from 'vitest';
import { focusOwnsKey } from './screen-keys.ts';

/* A screen's Enter must not swallow the press of the button, link or control in focus. */

const element = (html: string, selector = '[data-target]') => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector(selector);
};

describe('keys the focused element owns', () => {
  it.each([
    '<button data-target>Open</button>',
    '<a href="/runs" data-target>Runs</a>',
    '<div role="button" data-target>Open</div>',
    '<select data-target><option>One</option></select>',
    '<details><summary data-target>More</summary></details>',
    '<input data-target />',
    '<textarea data-target></textarea>',
    '<div contenteditable="true" data-target></div>',
    '<button><span data-target>Inside a button</span></button>',
  ])('leaves Enter and Space to %s', (html) => {
    expect(focusOwnsKey(element(html), 'Enter')).toBe(true);
    expect(focusOwnsKey(element(html), ' ')).toBe(true);
  });

  it('gives Enter to the screen when focus is on the page or a plain element', () => {
    expect(focusOwnsKey(document.body, 'Enter')).toBe(false);
    expect(focusOwnsKey(element('<article tabindex="-1" data-target></article>'), 'Enter')).toBe(
      false,
    );
    expect(focusOwnsKey(element('<a data-target>No href</a>'), 'Enter')).toBe(false);
    expect(focusOwnsKey(null, 'Enter')).toBe(false);
  });

  it('keeps the screen keys that do not press a control, like J and K, on a focused button', () => {
    expect(focusOwnsKey(element('<button data-target>Open</button>'), 'j')).toBe(false);
    expect(focusOwnsKey(element('<button data-target>Open</button>'), 'shift+r')).toBe(false);
  });
});
