import { describe, expect, it } from 'vitest';
import type { Rolldown } from 'vite';
import { chunkGraph, inlineLogo } from './boot-frame.ts';

describe('inlineLogo', () => {
  const file =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img" aria-label="Bemmoly">' +
    '<path style="fill: var(--brand-mark-bg, #2356C9)" d="M0 0"/>' +
    '<path style="fill: var(--brand-mark-fg, #9A85EA)" d="M1 1"/>' +
    '<path fill="currentColor" d="M2 2"/></svg>';

  it('keeps the designed colours as plain fills, since the CSP refuses inline styles', () => {
    const svg = inlineLogo(file);
    expect(svg).not.toContain('style=');
    expect(svg).toContain('<path class="brand-mark-bg" fill="#2356C9" d="M0 0"/>');
    expect(svg).toContain('<path class="brand-mark-fg" fill="#9A85EA" d="M1 1"/>');
    expect(svg).toContain('<path fill="currentColor" d="M2 2"/>');
  });

  it('makes the logo decorative, since the boot frame is hidden from assistive technology', () => {
    const svg = inlineLogo(file);
    expect(svg).toMatch(/^<svg aria-hidden="true" focusable="false"/);
    expect(svg).not.toMatch(/role=|aria-label=/);
  });
});

describe('chunkGraph', () => {
  const chunk = (fileName: string, imports: string[]) =>
    ({ type: 'chunk', fileName, imports }) as unknown as Rolldown.OutputChunk;
  const bundle = Object.fromEntries(
    [
      chunk('mount.js', ['react.js', 'shared.js']),
      chunk('react.js', ['shared.js']),
      chunk('shared.js', ['preload.js']),
      chunk('preload.js', []),
    ].map((output) => [output.fileName, output]),
  ) as Rolldown.OutputBundle;

  it('lists the chunk and everything it imports once, minus what is already loading', () => {
    const files = chunkGraph(
      bundle,
      bundle['mount.js'] as Rolldown.OutputChunk,
      new Set(['preload.js']),
    );
    expect(files).toEqual(['mount.js', 'react.js', 'shared.js']);
  });
});
