import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Kbd } from './kbd.tsx';
import { ariaKeyShortcuts, parseKeys, shortcutText, spokenKeys } from './keys.ts';

describe('keys', () => {
  it('reads shortcuts written in words and the symbols the first release typed', () => {
    expect(parseKeys('Mod+K')).toEqual([{ name: 'mod' }, { text: 'K' }]);
    expect(parseKeys('Up Down')).toEqual([{ name: 'up' }, { name: 'down' }]);
    expect(parseKeys('⌘⏎')).toEqual([{ name: 'mod' }, { name: 'enter' }]);
    expect(parseKeys('⌘ n')).toEqual([{ name: 'mod' }, { text: 'N' }]);
    expect(parseKeys('/')).toEqual([{ text: '/' }]);
  });

  it('spells keys out per platform', () => {
    expect(spokenKeys('Mod+Alt+M', true)).toBe('Command Option M');
    expect(spokenKeys('Mod+Alt+M', false)).toBe('Control Alt M');
    expect(ariaKeyShortcuts('Mod+K', true)).toBe('Meta+K');
    expect(ariaKeyShortcuts('Mod+K', false)).toBe('Control+K');
    expect(shortcutText('Mod+Shift+8', false)).toBe('Ctrl+Shift+8');
    expect(shortcutText('Mod+B', true)).toBe('⌘B');
  });
});

describe('Kbd', () => {
  it('draws modifiers and arrows as icons, never as characters', () => {
    const { container } = render(<Kbd keys="Up Down" />);
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.textContent).toBe('Up arrow Down arrow');
  });

  it('writes Ctrl where Command is an Apple key', () => {
    const { container } = render(<Kbd keys="Mod+K" />);
    const visible = [...container.querySelectorAll('[aria-hidden]')].map((el) => el.textContent);
    expect(visible.join('')).toBe('Ctrl+K');
  });
});
