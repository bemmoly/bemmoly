import { useCallback, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { buildView, toGroups, typeahead } from './filter.ts';
import type { SelectOption, SelectProps } from './types.ts';
import { useAsyncOptions } from './use-async-options.ts';

export const DEFAULT_MAX_VISIBLE = 50;
const TYPEAHEAD_RESET_MS = 500;

type Spot = 'selected' | 'first' | 'last';

/** First or last enabled index, walking from `from` in `step` direction. */
function enabledFrom(options: readonly SelectOption[], from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < options.length; i += step) if (!options[i]?.disabled) return i;
  return -1;
}

/** State and keyboard behaviour of the Select: value, open list, query and active option. */
export function useSelect(props: SelectProps) {
  const {
    options,
    groups,
    value: controlled,
    defaultValue,
    onChange,
    searchable,
    loadOptions,
    name = '',
    maxVisible = DEFAULT_MAX_VISIBLE,
  } = props;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? '');
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [chosen, setChosen] = useState<SelectOption | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [typed, setTyped] = useState({ text: '', at: 0 });
  const listId = useId();

  const source = useMemo(() => toGroups(options, groups), [options, groups]);
  const count = source.reduce((sum, group) => sum + group.options.length, 0);
  const searchOn = Boolean(searchable || loadOptions || count > maxVisible);
  const remote = useAsyncOptions(loadOptions, query, open && (query.trim() !== '' || count === 0));

  const selected =
    source.flatMap((group) => group.options).find((option) => option.value === value) ??
    (chosen?.value === value ? chosen : undefined);
  const view = useMemo(() => {
    const pin = remote.options !== null || !query.trim() ? selected : undefined;
    return remote.options !== null
      ? buildView([{ label: '', options: remote.options }], '', maxVisible, pin)
      : buildView(source, query, maxVisible, pin);
  }, [remote.options, source, query, maxVisible, selected]);

  const found = view.flat.findIndex((option) => option.value === activeValue);
  const active = found >= 0 && !view.flat[found]?.disabled ? found : enabledFrom(view.flat, 0, 1);

  const close = useCallback(
    (refocus = true) => {
      setOpen(false);
      setQuery('');
      if (refocus) anchor?.focus();
    },
    [anchor],
  );

  const openAt = (spot: Spot) => {
    const at =
      spot === 'last'
        ? view.flat[enabledFrom(view.flat, view.flat.length - 1, -1)]
        : spot === 'first'
          ? view.flat[enabledFrom(view.flat, 0, 1)]
          : (selected ?? view.flat[enabledFrom(view.flat, 0, 1)]);
    setActiveValue(at?.value ?? null);
    setOpen(true);
  };

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    setUncontrolled(option.value);
    setChosen(option);
    const target = { value: option.value, name };
    onChange?.({ value: option.value, option, target, currentTarget: target });
    close();
  };

  const moveTo = (index: number) => {
    const option = view.flat[index];
    if (option) setActiveValue(option.value);
  };

  const move = (step: 1 | -1) => {
    const next = enabledFrom(view.flat, active + step, step);
    if (next >= 0) moveTo(next);
  };

  /** Letters jump to the next option starting with them; a pause starts a new word. */
  const typeTo = (key: string) => {
    const now = Date.now();
    const text = now - typed.at > TYPEAHEAD_RESET_MS ? key : typed.text + key;
    setTyped({ text, at: now });
    const from = open ? active : view.flat.findIndex((option) => option.value === value);
    const index = typeahead(view.flat, text, from);
    if (index >= 0) moveTo(index);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const { key } = event;
    const printable = key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;
    if (!open) {
      if (key === 'ArrowDown' || key === 'Enter' || key === ' ') openAt('selected');
      else if (key === 'ArrowUp') openAt(selected ? 'selected' : 'last');
      else if (key === 'Home') openAt('first');
      else if (key === 'End') openAt('last');
      else if (printable && searchOn) {
        setQuery(key);
        setActiveValue(null);
        setOpen(true);
      } else if (printable) {
        setOpen(true);
        typeTo(key);
      } else return;
      event.preventDefault();
      return;
    }
    if (key === 'ArrowDown') move(1);
    else if (key === 'ArrowUp') move(-1);
    else if (key === 'Home') moveTo(enabledFrom(view.flat, 0, 1));
    else if (key === 'End') moveTo(enabledFrom(view.flat, view.flat.length - 1, -1));
    else if (key === 'Enter' || (key === ' ' && !searchOn)) choose(view.flat[active]);
    else if (key === 'Escape') {
      event.stopPropagation();
      close();
    } else if (key === 'Tab') return close();
    else if (printable && !searchOn) typeTo(key);
    else return;
    event.preventDefault();
  };

  return {
    value,
    open,
    query,
    setQuery: (next: string) => {
      setQuery(next);
      setActiveValue(null);
    },
    selected,
    view,
    active,
    setActiveValue,
    searchOn,
    remote,
    anchor,
    setTrigger: setAnchor,
    listId,
    optionId: (index: number) => `${listId}-${index}`,
    toggle: () => (open ? close() : openAt('selected')),
    close,
    choose,
    onKeyDown,
  };
}

export type SelectState = ReturnType<typeof useSelect>;
