import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { placeFloating } from '../../lib/floating.tsx';
import { expectAccessible } from '../../testing/a11y.ts';
import { Field } from '../input/index.ts';
import { Modal } from '../modal/index.ts';
import { buildView, typeahead } from './filter.ts';
import { Select, type SelectChangeEvent, type SelectOption, type SelectProps } from './index.ts';

const DAYS: SelectOption[] = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday', disabled: true },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
];

const PEOPLE: SelectOption[] = [
  { value: 'jose', label: 'José Álvarez', description: 'jose@acme.test' },
  { value: 'ana', label: 'Ana Lima', description: 'ana@acme.test' },
  { value: 'priya', label: 'Priya N.', description: 'priya@acme.test' },
];

function Harness(props: Partial<SelectProps> & { onPick?: (event: SelectChangeEvent) => void }) {
  const { onPick, ...rest } = props;
  const [value, setValue] = useState(rest.value ?? 'tue');
  return (
    <Select
      aria-label="Starts on"
      options={DAYS}
      {...rest}
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onPick?.(event);
      }}
    />
  );
}

const combobox = () => screen.getAllByRole('combobox')[0] as HTMLElement;
/** An option's text without the decorative tick on the chosen one. */
const text = (el: Element | null | undefined) => el?.textContent?.replace('✓', '');
const activeOption = () => {
  const id = combobox().getAttribute('aria-activedescendant');
  return id ? document.getElementById(id) : null;
};

describe('Select', () => {
  it('opens from the keyboard on the chosen option and moves past disabled ones', async () => {
    const onPick = vi.fn();
    const { container } = render(<Harness onPick={onPick} />);
    const box = combobox();
    expect(box.textContent).toContain('Tuesday');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(box.getAttribute('aria-expanded')).toBe('true');
    expect(text(activeOption())).toBe('Tuesday');
    fireEvent.keyDown(box, { key: 'ArrowDown' });
    expect(text(activeOption())).toBe('Thursday');
    fireEvent.keyDown(box, { key: 'End' });
    expect(text(activeOption())).toBe('Friday');
    fireEvent.keyDown(box, { key: 'Home' });
    expect(text(activeOption())).toBe('Monday');
    await expectAccessible(container);
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: 'mon' }));
    expect(onPick.mock.calls[0]?.[0].target.value).toBe('mon');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box.textContent).toContain('Monday');
  });

  it('jumps by type-ahead, chooses with Space and closes on Escape with focus kept', () => {
    render(<Harness />);
    const box = combobox();
    box.focus();
    fireEvent.keyDown(box, { key: 'f' });
    expect(text(activeOption())).toBe('Friday');
    fireEvent.keyDown(box, { key: ' ' });
    expect(box.textContent).toContain('Friday');
    fireEvent.keyDown(box, { key: 'ArrowUp' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(box, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(box);
  });

  it('marks the chosen option and closes on a click outside', () => {
    render(
      <div>
        <Harness />
        <p>Outside</p>
      </div>,
    );
    fireEvent.click(combobox());
    const chosen = screen.getByRole('option', { name: 'Tuesday' });
    expect(chosen.getAttribute('aria-selected')).toBe('true');
    fireEvent.pointerDown(screen.getByText('Outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('filters by label and description, ignoring case and accents', () => {
    render(<Harness options={PEOPLE} value="ana" searchable />);
    fireEvent.click(combobox());
    const search = screen.getByRole('combobox', { name: 'Search' });
    expect(document.activeElement).toBe(search);
    fireEvent.change(search, { target: { value: 'ALVAREZ' } });
    expect(screen.getAllByRole('option').map(text)).toEqual(['José Álvarezjose@acme.test']);
    fireEvent.change(search, { target: { value: 'priya@' } });
    expect(screen.getByRole('option').textContent).toContain('Priya N.');
    fireEvent.change(search, { target: { value: 'nobody' } });
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('asks the server after a pause and keeps the chosen option in view', async () => {
    const load = vi.fn(async (query: string) =>
      query === 'pri' ? [{ value: 'priya', label: 'Priya N.' }] : [],
    );
    render(<Harness options={PEOPLE.slice(0, 1)} value="jose" loadOptions={load} />);
    fireEvent.click(combobox());
    expect(load).not.toHaveBeenCalled();
    const search = screen.getByRole('combobox', { name: 'Search' });
    fireEvent.change(search, { target: { value: 'p' } });
    fireEvent.change(search, { target: { value: 'pri' } });
    expect(screen.getByRole('status', { name: 'Searching' })).toBeTruthy();
    await screen.findByRole('option', { name: 'Priya N.' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]?.[0]).toBe('pri');
    expect(screen.getAllByRole('option').map(text)).toEqual([
      'José Álvarezjose@acme.test',
      'Priya N.',
    ]);
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(combobox().textContent).toContain('Priya N.');
    fireEvent.click(combobox());
    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'zz' },
    });
    expect(await screen.findByText('No matches')).toBeTruthy();
    expect(screen.getAllByRole('option').map(text)).toEqual(['Priya N.']);
  });

  it('aborts a search a newer keystroke replaces and ignores its AbortError', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn(
      (query: string, signal: AbortSignal) =>
        new Promise<SelectOption[]>((resolve, reject) => {
          signals.push(signal);
          signal.addEventListener('abort', () =>
            reject(new DOMException('The search was replaced', 'AbortError')),
          );
          if (query === 'an') resolve([{ value: 'ana', label: 'Ana Lima' }]);
        }),
    );
    render(<Harness options={[]} value="" loadOptions={load} />);
    fireEvent.click(combobox());
    const search = screen.getByRole('combobox', { name: 'Search' });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    fireEvent.change(search, { target: { value: 'an' } });
    expect(signals[0]?.aborted).toBe(true);
    await screen.findByRole('option', { name: 'Ana Lima' });
    expect(screen.queryByText(/Search is unavailable/)).toBeNull();
  });

  it('says so when the server finds nothing', async () => {
    const load = vi.fn(async () => []);
    render(<Harness options={[]} value="" loadOptions={load} placeholder="Choose…" />);
    expect(combobox().textContent).toContain('Choose…');
    fireEvent.click(combobox());
    await waitFor(() => expect(load).toHaveBeenCalledWith('', expect.any(AbortSignal)));
    expect(await screen.findByText('No matches')).toBeTruthy();
  });

  it('draws 50 options with a footer and turns search on for long lists', () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ value: `u${i}`, label: `User ${i}` }));
    render(<Harness options={many} value="u120" />);
    fireEvent.click(combobox());
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(51);
    expect(text(options[0])).toBe('User 120');
    expect(screen.getByText('Showing 50 of 300 · type to narrow')).toBeTruthy();
    fireEvent.change(screen.getByRole('combobox', { name: 'Search' }), {
      target: { value: 'user 29' },
    });
    expect(screen.getAllByRole('option')).toHaveLength(11);
    expect(screen.queryByText(/type to narrow/)).toBeNull();
  });

  it('portals the popover out of a clipping container, and into an open dialog', () => {
    const { unmount } = render(
      <div data-testid="card" style={{ overflow: 'hidden' }}>
        <Harness />
      </div>,
    );
    fireEvent.click(combobox());
    const layer = screen.getByRole('listbox').closest('[data-select-popover]');
    expect(layer?.parentElement).toBe(document.body);
    expect(screen.getByTestId('card').contains(layer as Node)).toBe(false);
    unmount();
    render(
      <Modal open onClose={() => {}} title="Create team">
        <Field label="Lead">
          <Select options={DAYS} defaultValue="mon" />
        </Field>
      </Modal>,
    );
    fireEvent.click(screen.getByRole('combobox', { name: 'Lead' }));
    expect(screen.getByRole('listbox').closest('dialog')).toBe(screen.getByRole('dialog'));
  });

  it('takes a Field label, reads as invalid on error and submits through a hidden input', () => {
    render(
      <form aria-label="Team">
        <Field label="Lead" error="Choose a lead.">
          <Select name="lead" options={DAYS} defaultValue="thu" />
        </Field>
      </form>,
    );
    const box = screen.getByRole('combobox', { name: 'Lead' });
    expect(box.getAttribute('aria-invalid')).toBe('true');
    const form = screen.getByRole('form', { name: 'Team' }) as HTMLFormElement;
    expect(new FormData(form).get('lead')).toBe('thu');
    act(() => box.click());
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('draws the ghost variant without a resting border and still opens and chooses', () => {
    const onPick = vi.fn();
    render(<Harness variant="ghost" onPick={onPick} />);
    const box = screen.getByRole('combobox', { name: 'Starts on' });
    expect(box.className).toContain('border-transparent');
    expect(box.className).not.toContain('border-line bg-card');
    act(() => box.click());
    fireEvent.click(screen.getByRole('option', { name: 'Friday' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ value: 'fri' }));
  });
});

describe('Select helpers', () => {
  it('pins the chosen option and counts what is drawn', () => {
    const view = buildView([{ label: '', options: DAYS }], '', 2, DAYS[4]);
    expect(view.flat.map((o) => o.value)).toEqual(['fri', 'mon', 'tue']);
    expect([view.shown, view.total]).toEqual([2, 5]);
  });

  it('cycles type-ahead on a repeated letter', () => {
    expect(typeahead(DAYS, 't', -1)).toBe(1);
    expect(typeahead(DAYS, 'tt', 1)).toBe(3);
    expect(typeahead(DAYS, 'thu', 0)).toBe(3);
  });

  it('flips a popover above its anchor when there is no room below', () => {
    const view = { width: 1000, height: 600 };
    const low = { top: 540, bottom: 572, left: 900, right: 1000 };
    const below = placeFloating({ ...low, top: 40, bottom: 72 }, { width: 240, height: 300 }, view);
    expect(below.side).toBe('bottom');
    const above = placeFloating(low, { width: 240, height: 300 }, view);
    expect(above).toMatchObject({ side: 'top', top: 236, left: 752 });
    expect(placeFloating(low, { width: 240, height: 300 }, view, 'end').left).toBe(752);
  });
});
