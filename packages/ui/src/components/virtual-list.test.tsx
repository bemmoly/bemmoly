import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef, type ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../testing/a11y.ts';
import { Checkbox } from './checkbox/index.ts';
import { VirtualList, virtualWindow, type VirtualListHandle } from './virtual-list/index.ts';

function list(count: number, props: Partial<ComponentProps<typeof VirtualList>> = {}) {
  return (
    <VirtualList
      count={count}
      rowHeight={44}
      height={440}
      role="listbox"
      aria-label="Projects"
      tabIndex={0}
      renderRow={(index, style) => (
        <div key={index} role="option" aria-selected={false} style={style}>
          Row {index}
        </div>
      )}
      {...props}
    />
  );
}

describe('VirtualList', () => {
  it('draws only the rows in view and the overscan, with a spacer for the rest', async () => {
    const { container } = render(list(1240));
    expect(screen.getAllByRole('option')).toHaveLength(14);
    const spacer = screen.getByRole('listbox').firstElementChild as HTMLElement;
    expect(spacer.style.height).toBe(`${1240 * 44}px`);
    await expectAccessible(container);
  });

  it('moves the window as it scrolls and reports the rows in view', () => {
    const onRangeChange = vi.fn();
    render(list(1240, { onRangeChange }));
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: 0, end: 10 });
    const box = screen.getByRole('listbox');
    act(() => {
      box.scrollTop = 44 * 100;
      fireEvent.scroll(box);
    });
    expect(onRangeChange).toHaveBeenLastCalledWith({ start: 100, end: 110 });
    expect(screen.getByText('Row 96')).toBeTruthy();
    expect(screen.queryByText('Row 95')).toBeNull();
    expect(screen.getByText('Row 113')).toBeTruthy();
  });

  it('scrolls a row into view the least it needs to', () => {
    const ref = createRef<VirtualListHandle>();
    render(list(1240, { ref }));
    const box = screen.getByRole('listbox');
    act(() => ref.current?.scrollToIndex(20));
    expect(box.scrollTop).toBe(21 * 44 - 440);
    act(() => ref.current?.scrollToIndex(2));
    expect(box.scrollTop).toBe(88);
    act(() => ref.current?.scrollToIndex(50, 'start'));
    expect(box.scrollTop).toBe(2200);
  });

  it('keeps the window inside the list', () => {
    expect(virtualWindow(0, 440, 44, 3, 4)).toEqual({
      visible: { start: 0, end: 3 },
      from: 0,
      to: 3,
    });
    expect(virtualWindow(4400, 440, 44, 1240, 4).from).toBe(96);
  });
});

describe('Checkbox indeterminate', () => {
  it('reads as mixed, sets the DOM property and draws the minus', async () => {
    const { container, rerender } = render(
      <Checkbox aria-label="Select all shown" checked={false} indeterminate onChange={() => {}} />,
    );
    const box = screen.getByRole('checkbox', { name: 'Select all shown' }) as HTMLInputElement;
    expect(box.indeterminate).toBe(true);
    expect(box.getAttribute('aria-checked')).toBe('mixed');
    expect(box.className).toContain('bg-acc-fill');
    await expectAccessible(container);
    rerender(<Checkbox aria-label="Select all shown" checked onChange={() => {}} />);
    expect(box.indeterminate).toBe(false);
    expect(box.getAttribute('aria-checked')).toBeNull();
    expect(box.checked).toBe(true);
  });
});
