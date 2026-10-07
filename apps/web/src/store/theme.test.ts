import { describe, expect, it } from 'vitest';
import { isThemeChoice, resolveThemeChoice } from './theme.ts';

describe('theme choice', () => {
  it('follows the OS for system and keeps explicit presets', () => {
    expect(resolveThemeChoice('system', false)).toBe('light');
    expect(resolveThemeChoice('system', true)).toBe('dark');
    expect(resolveThemeChoice('ocean', false)).toBe('ocean');
  });

  it('accepts only known presets', () => {
    expect(isThemeChoice('midnight')).toBe(true);
    expect(isThemeChoice('system')).toBe(true);
    expect(isThemeChoice('neon')).toBe(false);
  });
});
