import { useCallback, useState, type KeyboardEvent } from 'react';

export interface ListNavigation {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * ↑ ↓ Home End move the highlight and wrap; ⏎ opens; ⌘⏎ runs. The highlight
 * resets to the first row whenever the list itself changes.
 */
export function useListNavigation(
  count: number,
  listKey: string,
  onSelect: (index: number, modifier: boolean) => void,
): ListNavigation {
  const [state, setState] = useState({ index: 0, key: listKey });
  const activeIndex = state.key === listKey ? Math.min(state.index, Math.max(count - 1, 0)) : 0;
  const setActiveIndex = useCallback(
    (index: number) => setState({ index, key: listKey }),
    [listKey],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (count === 0) return;
      const move = (index: number) => {
        event.preventDefault();
        setActiveIndex((index + count) % count);
      };
      if (event.key === 'ArrowDown') move(activeIndex + 1);
      else if (event.key === 'ArrowUp') move(activeIndex - 1);
      else if (event.key === 'Home') move(0);
      else if (event.key === 'End') move(count - 1);
      else if (event.key === 'Enter') {
        event.preventDefault();
        onSelect(activeIndex, event.metaKey || event.ctrlKey);
      }
    },
    [activeIndex, count, onSelect, setActiveIndex],
  );

  return { activeIndex, setActiveIndex, onKeyDown };
}
