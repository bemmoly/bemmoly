import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TYPING_ATTRIBUTE, usePageTyping, type PageEditor } from './screen-context.ts';
import { useTypingFlag } from './use-typing-flag.ts';

afterEach(cleanup);

function fakeEditor(editable = true) {
  const dom = document.createElement('div');
  document.body.append(dom);
  return { dom, editor: { view: { dom }, isEditable: editable } as unknown as PageEditor };
}

const typing = () => document.documentElement.hasAttribute(TYPING_ATTRIBUTE);
const key = (target: EventTarget, init: KeyboardEventInit) =>
  act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init })));
const move = (x: number, y: number) =>
  act(
    () => void document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y })),
  );

describe('the typing flag', () => {
  it('turns on with a written key and off when the pointer travels', () => {
    const { dom, editor } = fakeEditor();
    renderHook(() => useTypingFlag(editor));
    key(dom, { key: 'a' });
    expect(usePageTyping.getState().typing).toBe(true);
    expect(typing()).toBe(true);
    move(10, 10);
    move(12, 11);
    expect(typing()).toBe(true);
    move(40, 10);
    expect(typing()).toBe(false);
  });

  it('turns off on Esc, and ignores shortcuts and read-only bodies', () => {
    const { dom, editor } = fakeEditor();
    renderHook(() => useTypingFlag(editor));
    key(dom, { key: 'k', metaKey: true });
    expect(typing()).toBe(false);
    key(dom, { key: 'Enter' });
    expect(typing()).toBe(true);
    key(document, { key: 'Escape' });
    expect(typing()).toBe(false);

    const reader = fakeEditor(false);
    renderHook(() => useTypingFlag(reader.editor));
    key(reader.dom, { key: 'a' });
    expect(typing()).toBe(false);
  });
});
