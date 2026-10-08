import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible, expectFocusRing } from '../testing/a11y.ts';
import { Button, IconButton } from './button/index.ts';
import { Checkbox, Radio } from './checkbox/index.ts';
import { Field, Input, SearchInput } from './input/index.ts';
import { SegmentedControl } from './segmented-control/index.ts';
import { Select } from './select/index.ts';
import { Switch } from './switch/index.ts';
import { Textarea } from './textarea/index.ts';

describe('Button', () => {
  it('renders every variant accessibly with a focus ring', async () => {
    const { container } = render(
      <div>
        {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
          <Button key={v} variant={v}>
            {v}
          </Button>
        ))}
        <IconButton label="Inbox" icon="inbox" badge={4} />
      </div>,
    );
    await expectAccessible(container);
    for (const button of screen.getAllByRole('button')) expectFocusRing(button);
    expect(screen.getByRole('button', { name: 'Inbox, 4' })).toBeTruthy();
  });

  it('uses the accent fill and the measured sizes', () => {
    render(<Button variant="primary">Create</Button>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-ac-fill');
    expect(button.className).toContain('h-control');
    expect(button.className).toContain('px-3.5');
  });

  it('disables and marks itself busy while loading', () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('form controls', () => {
  it('labels inputs through Field and passes axe', async () => {
    const { container } = render(
      <div>
        <Field label="Workspace name" hint="Shown on the login page.">
          <Input size="lg" defaultValue="Acme Labs" />
        </Field>
        <Field label="Search" error="Search is unavailable right now. Try again in a minute.">
          <SearchInput hint="/" />
        </Field>
        <Field label="Emails">
          <Textarea />
        </Field>
        <Field label="Starts on">
          <Select options={[{ value: 'tue', label: 'Tuesday' }]} defaultValue="tue" />
        </Field>
        <Checkbox label="Issue type" defaultChecked />
        <Radio label="Scrum" name="method" defaultChecked />
      </div>,
    );
    await expectAccessible(container);
    const search = screen.getByRole('searchbox');
    expect(search.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Workspace name').closest('div')?.className).toContain(
      'focus-within:border-ac',
    );
    expectFocusRing(screen.getByRole('checkbox'));
    expectFocusRing(screen.getByRole('radio'));
  });

  it('draws a recessed Input like a read-only one but keeps it editable', () => {
    render(
      <Field label="URL">
        <Input size="lg" mono tone="recessed" defaultValue="https://bemmoly.example" />
      </Field>,
    );
    const input = screen.getByLabelText('URL');
    expect(input.closest('div')?.className).toContain('bg-sf2');
    expect(input.hasAttribute('readonly')).toBe(false);
  });

  it('toggles a Switch and exposes its state', async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch aria-label="Require SSO" checked={on} onCheckedChange={setOn} />;
    }
    const { container } = render(<Harness />);
    const sw = screen.getByRole('switch');
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe('true');
    expectFocusRing(sw);
    await expectAccessible(container);
  });

  it('moves a SegmentedControl with the arrow keys', async () => {
    function Harness() {
      const [mode, setMode] = useState<'light' | 'dark'>('light');
      return (
        <SegmentedControl
          aria-label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      );
    }
    const { container } = render(<Harness />);
    const light = screen.getByRole('radio', { name: 'Light' });
    fireEvent.keyDown(light, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Dark' }));
    expectFocusRing(light);
    await expectAccessible(container);
  });
});
