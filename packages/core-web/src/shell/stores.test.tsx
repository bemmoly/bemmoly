import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withCreate } from './create.tsx';
import { typingInField, useGlobalKeys } from './keys.ts';
import { readPreference, setPreferenceOwner, writePreference } from './person-store.ts';
import { recordRecent, useRecents, type RecentItem } from './recents.ts';
import { useCurrentScreenActions, useScreenActions, type ScreenAction } from './screen-actions.ts';

const item = (id: string): Omit<RecentItem, 'openedAt'> => ({
  id,
  title: id,
  path: `/work/issue/${id}`,
  look: { kind: 'icon', icon: 'doc' },
  group: 'Issues',
});

describe('per-person preferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPreferenceOwner(null);
  });

  it('keeps each person their own values on a shared browser', () => {
    setPreferenceOwner('rohan');
    writePreference('sidebar.collapsed', true);
    setPreferenceOwner('priya');
    expect(readPreference('sidebar.collapsed', false)).toBe(false);
    setPreferenceOwner('rohan');
    expect(readPreference('sidebar.collapsed', false)).toBe(true);
    expect(window.localStorage.getItem('bemmoly.sidebar.collapsed.rohan')).toBe('true');
  });

  it('falls back to the default when stored data is unreadable', () => {
    setPreferenceOwner('rohan');
    window.localStorage.setItem('bemmoly.recents.rohan', '{not json');
    expect(readPreference('recents', [])).toEqual([]);
  });
});

describe('recents', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setPreferenceOwner(null);
    setPreferenceOwner('rohan');
  });
  afterEach(cleanup);

  it('puts the newest first, moves a revisit to the top and keeps thirty', () => {
    for (let index = 0; index < 32; index += 1) recordRecent(item(`PLT-${index}`));
    recordRecent(item('PLT-5'));
    const list = readPreference<RecentItem[]>('recents', []);
    expect(list).toHaveLength(30);
    expect(list[0]?.id).toBe('PLT-5');
    expect(list.filter((entry) => entry.id === 'PLT-5')).toHaveLength(1);
  });

  it('re-renders readers when something is opened', () => {
    function Four() {
      return (
        <p>
          {useRecents(4)
            .map((entry) => entry.id)
            .join(',')}
        </p>
      );
    }
    render(<Four />);
    act(() => recordRecent(item('PLT-1')));
    act(() => recordRecent(item('PLT-2')));
    expect(screen.getByText('PLT-2,PLT-1')).toBeTruthy();
  });
});

describe('screen actions', () => {
  afterEach(cleanup);

  it('offers a screen’s actions only while it is mounted, calling the newest handler', () => {
    const seen: ScreenAction[][] = [];
    function Palette() {
      seen.push(useCurrentScreenActions());
      return null;
    }
    function Issue({ run }: { run: () => void }) {
      useScreenActions([{ id: 'assign', title: 'Assign PLT-1 to me', run }]);
      return null;
    }
    const first = vi.fn();
    const second = vi.fn();
    const view = render(
      <>
        <Palette />
        <Issue run={first} />
      </>,
    );
    view.rerender(
      <>
        <Palette />
        <Issue run={second} />
      </>,
    );
    seen.at(-1)?.[0]?.run();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    view.rerender(<Palette />);
    expect(seen.at(-1)).toEqual([]);
  });
});

describe('global keys', () => {
  afterEach(cleanup);

  function Keys(props: { bindings: Record<string, () => void> }) {
    useGlobalKeys(props.bindings);
    return <input aria-label="Title" />;
  }
  const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
    act(() => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    });

  it('runs single keys and G chords, but never while typing in a field', () => {
    const create = vi.fn();
    const board = vi.fn();
    const palette = vi.fn();
    render(<Keys bindings={{ c: create, 'g b': board, 'mod+k': palette }} />);
    press('c');
    press('g');
    press('b');
    expect(create).toHaveBeenCalledOnce();
    expect(board).toHaveBeenCalledOnce();
    const field = screen.getByLabelText('Title');
    press('c', {}, field);
    expect(create).toHaveBeenCalledOnce();
    press('k', { metaKey: true }, field);
    expect(palette).toHaveBeenCalledOnce();
  });

  it('knows a field from a checkbox', () => {
    const box = document.createElement('input');
    box.type = 'checkbox';
    expect(typingInField(box)).toBe(false);
    expect(typingInField(document.createElement('textarea'))).toBe(true);
  });
});

describe('create in place', () => {
  it('names the dialog in the address and takes it out again', () => {
    expect(withCreate('/work/board/PLT?q=x', 'work.create-issue')).toBe(
      '/work/board/PLT?q=x&create=work.create-issue',
    );
    expect(withCreate('/work/board/PLT?create=work.create-issue', null)).toBe('/work/board/PLT');
  });
});
