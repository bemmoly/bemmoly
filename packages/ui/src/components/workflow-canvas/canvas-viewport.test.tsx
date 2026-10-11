import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { frameScroll, revealInCanvas } from './canvas-viewport.ts';
import { StatusNode } from './status-node.tsx';
import { WorkflowCanvas } from './workflow-canvas.tsx';

const UNITS = { width: 1000, height: 560 };

/** jsdom lays nothing out: give an element the box a browser would, and a working scroll. */
function lay(el: HTMLElement, box: Partial<Record<string, number>>) {
  let left = 0;
  let top = 0;
  Object.defineProperties(el, {
    ...Object.fromEntries(
      Object.entries(box).map(([key, value]) => [key, { configurable: true, value }]),
    ),
    scrollLeft: { configurable: true, get: () => left, set: (v: number) => (left = v) },
    scrollTop: { configurable: true, get: () => top, set: (v: number) => (top = v) },
  });
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;

afterEach(() => vi.restoreAllMocks());

describe('frameScroll', () => {
  const box = { viewWidth: 400, viewHeight: 558, surfaceWidth: 1000, surfaceHeight: 560 };

  it('centres a region that fits with its margins', () => {
    expect(frameScroll({ left: 500, top: 0, right: 700, bottom: 560 }, UNITS, box).left).toBe(400);
  });

  it('opens a wider region on its first column, a margin in', () => {
    expect(frameScroll({ left: 35, top: 0, right: 945, bottom: 560 }, UNITS, box).left).toBe(11);
  });

  it('never scrolls past either end of the surface', () => {
    expect(frameScroll({ left: 900, top: 0, right: 1000, bottom: 560 }, UNITS, box).left).toBe(600);
    expect(frameScroll({ left: 0, top: 0, right: 990, bottom: 560 }, UNITS, box).left).toBe(0);
  });
});

describe('WorkflowCanvas viewport', () => {
  function renderCanvas() {
    const onNode = vi.fn();
    render(
      <WorkflowCanvas label="Software workflow">
        <StatusNode name="Done" category="done" x="80%" y="50%" onClick={onNode} />
      </WorkflowCanvas>,
    );
    const viewport = screen.getByRole('group', { name: 'Software workflow' });
    lay(viewport, { clientWidth: 400, clientHeight: 558, scrollWidth: 1000, scrollHeight: 558 });
    return { viewport, surface: viewport.firstElementChild as HTMLElement, onNode };
  }

  it('pans when empty canvas is dragged, and stops on release', () => {
    const { viewport, surface } = renderCanvas();
    viewport.scrollLeft = 200;
    fireEvent.pointerDown(surface, { button: 0, clientX: 300, clientY: 100, pointerType: 'mouse' });
    expect(viewport.className).toContain('cursor-grabbing');
    fireEvent.pointerMove(window, { clientX: 180, clientY: 100 });
    expect(viewport.scrollLeft).toBe(320);
    fireEvent.pointerMove(window, { clientX: 350, clientY: 100 });
    expect(viewport.scrollLeft).toBe(150);
    fireEvent.pointerUp(window);
    fireEvent.pointerMove(window, { clientX: 0, clientY: 100 });
    expect(viewport.scrollLeft).toBe(150);
    expect(viewport.className).not.toContain('cursor-grabbing');
  });

  it('leaves a press on a node to the node', () => {
    const { viewport } = renderCanvas();
    const node = screen.getByRole('button', { name: /Done/ });
    fireEvent.pointerDown(node, { button: 0, clientX: 300, clientY: 100, pointerType: 'mouse' });
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 });
    expect(viewport.scrollLeft).toBe(0);
  });

  it('opens scrolled to the frame it is given', () => {
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(558);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(558);
    const scrolled = vi.spyOn(Element.prototype, 'scrollLeft', 'set');
    render(
      <WorkflowCanvas label="Framed" frame={{ left: 600, top: 100, right: 800, bottom: 300 }}>
        <StatusNode name="Done" category="done" x="70%" y="40%" />
      </WorkflowCanvas>,
    );
    expect(scrolled).toHaveBeenCalledWith(500);
  });
});

describe('revealInCanvas', () => {
  it('scrolls just far enough to show an element clipped on the right', () => {
    const { container } = render(
      <WorkflowCanvas label="Reveal">
        <StatusNode name="Done" category="done" x="90%" y="50%" />
      </WorkflowCanvas>,
    );
    const viewport = container.querySelector<HTMLElement>('[data-canvas-viewport]')!;
    lay(viewport, { clientWidth: 400, clientHeight: 558, clientLeft: 1, clientTop: 1 });
    vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(rect(100, 0, 402, 560));
    const node = screen.getByRole('button', { name: /Done/ });
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(rect(450, 200, 150, 56));
    revealInCanvas(node);
    expect(viewport.scrollLeft).toBe(123);
    expect(viewport.scrollTop).toBe(0);
  });
});
