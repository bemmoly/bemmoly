import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMING } from '../tokens/interaction.ts';
import { ToastProvider, useToast } from './toast/toaster.tsx';
import { Tooltip } from './tooltip/tooltip.tsx';

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const bar = () =>
    render(
      <>
        <Tooltip label="New issue" keys="C">
          <button type="button">New</button>
        </Tooltip>
        <Tooltip label="Search" keys="/">
          <button type="button">Find</button>
        </Tooltip>
      </>,
    );

  it('opens after the hover delay, with its shortcut drawn as keys', () => {
    bar();
    fireEvent.pointerEnter(screen.getByText('New').parentElement as Element);
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => vi.advanceTimersByTime(TIMING.tooltipDelayMs));
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('New issue');
    expect(tip.querySelector('kbd')).not.toBeNull();
  });

  it('opens the next tooltip at once when the pointer moves along a toolbar', () => {
    bar();
    const [first, second] = ['New', 'Find'].map((text) => screen.getByText(text).parentElement);
    fireEvent.pointerEnter(first as Element);
    act(() => vi.advanceTimersByTime(TIMING.tooltipDelayMs));
    fireEvent.pointerLeave(first as Element);
    fireEvent.pointerEnter(second as Element);
    expect(screen.getByRole('tooltip').textContent).toContain('Search');
  });

  it('opens at once on focus and closes on Escape', () => {
    bar();
    fireEvent.focus(screen.getByText('Find'));
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

function UndoButton({ onUndo }: { onUndo: () => void }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.undo({ title: 'Issue deleted', onUndo })}>
      Delete
    </button>
  );
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = (onUndo = vi.fn()) => {
    render(
      <ToastProvider>
        <UndoButton onUndo={onUndo} />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText('Delete'));
    return onUndo;
  };

  it('offers Undo for six seconds, then leaves', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    act(() => vi.advanceTimersByTime(TIMING.toastMs + 200));
    expect(screen.queryByText('Issue deleted')).toBeNull();
  });

  it('holds while the pointer is over it', () => {
    setup();
    const toast = screen.getByRole('status').parentElement as Element;
    act(() => vi.advanceTimersByTime(TIMING.toastMs - 1000));
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText('Issue deleted')).toBeTruthy();
    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(1200));
    expect(screen.queryByText('Issue deleted')).toBeNull();
  });

  it('runs Undo and leaves at once, and Escape dismisses the focused toast', () => {
    const onUndo = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Issue deleted')).toBeNull();

    fireEvent.click(screen.getByText('Delete'));
    fireEvent.keyDown(screen.getByRole('button', { name: 'Undo' }), { key: 'Escape' });
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByText('Issue deleted')).toBeNull();
  });
});
