import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BOOT_LOOK_KEY, rememberBootLook } from './boot-frame.ts';

/** public/boot-theme.js as the browser runs it, before any app code. */
const runBootScript = () =>
  new Function(readFileSync(join(process.cwd(), 'public/boot-theme.js'), 'utf8'))();

describe('the boot look', () => {
  afterEach(() => {
    localStorage.clear();
    const root = document.documentElement;
    delete root.dataset['theme'];
    delete root.dataset['mode'];
    root.removeAttribute('style');
  });

  it('paints the next boot frame in the preset this device last showed', () => {
    rememberBootLook({ theme: 'dark', mode: 'dark' });
    runBootScript();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.dataset['mode']).toBe('dark');
  });

  it('restores a custom theme from its custom properties', () => {
    rememberBootLook({ theme: 'custom', mode: 'dark', vars: { '--canvas': '#101010' } });
    runBootScript();
    expect(document.documentElement.style.getPropertyValue('--canvas')).toBe('#101010');
  });

  it('keeps the default look when nothing, or something unreadable, is stored', () => {
    runBootScript();
    expect(document.documentElement.dataset['theme']).toBeUndefined();
    localStorage.setItem(BOOT_LOOK_KEY, '{not json');
    expect(runBootScript).not.toThrow();
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('only sets custom properties, never other styles', () => {
    localStorage.setItem(
      BOOT_LOOK_KEY,
      JSON.stringify({ theme: 'x', mode: 'light', vars: { display: 'none', '--tx': 'red' } }),
    );
    runBootScript();
    expect(document.documentElement.style.getPropertyValue('display')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--tx')).toBe('red');
  });
});
