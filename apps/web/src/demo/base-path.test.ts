import { afterEach, describe, expect, it } from 'vitest';
import { keepUnderBase, underBase } from './base-path.ts';

describe('underBase', () => {
  it('prefixes root-relative app paths with the base', () => {
    expect(underBase('/demo/', '/work/board/PLT')).toBe('/demo/work/board/PLT');
    expect(underBase('/demo/', '/')).toBe('/demo/');
    expect(underBase('/demo/', '/settings?tab=users#top')).toBe('/demo/settings?tab=users#top');
  });

  it('leaves paths already under the base, other origins and the root base alone', () => {
    expect(underBase('/demo/', '/demo')).toBe('/demo');
    expect(underBase('/demo/', '/demo/work/board')).toBe('/demo/work/board');
    expect(underBase('/demo/', '/demo?x=1')).toBe('/demo?x=1');
    expect(underBase('/demo/', '//cdn.example/x')).toBe('//cdn.example/x');
    expect(underBase('/demo/', 'https://bemmoly.com/self-hosting')).toBe(
      'https://bemmoly.com/self-hosting',
    );
    expect(underBase('/', '/work/board')).toBe('/work/board');
  });

  it('treats a path that only starts with the base name as outside it', () => {
    expect(underBase('/demo/', '/demonstration')).toBe('/demo/demonstration');
  });
});

describe('keepUnderBase', () => {
  const { pushState, replaceState } = window.history;
  afterEach(() => {
    window.history.pushState = pushState;
    window.history.replaceState = replaceState;
    document.body.innerHTML = '';
  });

  it('keeps history entries and in-app links under the base', () => {
    const root = document.createElement('div');
    root.innerHTML = '<a href="/work/backlog/PLT">Backlog</a>';
    const outside = document.createElement('a');
    outside.setAttribute('href', '/self-hosting');
    document.body.append(root, outside);
    keepUnderBase('/demo/', root);

    window.history.pushState(null, '', '/work/board/PLT');
    expect(window.location.pathname).toBe('/demo/work/board/PLT');
    window.history.replaceState(null, '', '/work/issue/PLT-204');
    expect(window.location.pathname).toBe('/demo/work/issue/PLT-204');

    const link = root.querySelector('a');
    link?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(link?.getAttribute('href')).toBe('/demo/work/backlog/PLT');
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(outside.getAttribute('href')).toBe('/self-hosting');
  });
});
