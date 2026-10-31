import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { CustomFieldControl, type CustomFieldControlSpec } from './custom-field-control.tsx';
import { FormSections } from './form-sections.tsx';
import { minorUnitsOf } from './inputs.tsx';

const options = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'phone', label: 'Phone' },
];

function Controlled({
  field,
  onValue,
}: {
  field: CustomFieldControlSpec;
  onValue: (v: unknown) => void;
}) {
  const [value, setValue] = useState<unknown>(null);
  return (
    <CustomFieldControl
      field={field}
      value={value}
      onChange={(next) => {
        setValue(next);
        onValue(next);
      }}
    />
  );
}

describe('CustomFieldControl', () => {
  it('renders every kind labelled and accessible inside sections', async () => {
    const kinds: CustomFieldControlSpec[] = [
      { key: 'a', label: 'Title', kind: 'text', required: true },
      { key: 'b', label: 'Notes', kind: 'long_text' },
      { key: 'c', label: 'Count', kind: 'number' },
      { key: 'd', label: 'Budget', kind: 'money', currency: 'EUR' },
      { key: 'e', label: 'Due', kind: 'date' },
      { key: 'f', label: 'Device', kind: 'select', options },
      { key: 'g', label: 'Extras', kind: 'multi_select', options },
      { key: 'h', label: 'Manager', kind: 'person' },
      { key: 'i', label: 'Urgent', kind: 'boolean' },
      { key: 'j', label: 'Receipt', kind: 'file' },
    ];
    const { container } = render(
      <FormSections
        sections={[
          {
            id: 's',
            title: 'Request',
            items: kinds.map((field) => ({
              key: field.key,
              node: <CustomFieldControl field={field} value={null} onChange={() => undefined} />,
            })),
          },
        ]}
      />,
    );
    await expectAccessible(container);
    expect(screen.getByRole('region', { name: 'Request' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Title/ })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Extras' })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Urgent' })).toBeTruthy();
  });

  it('reports numbers, money in minor units, and null when cleared', () => {
    const onValue = vi.fn();
    render(
      <Controlled
        field={{ key: 'm', label: 'Budget', kind: 'money', currency: 'EUR' }}
        onValue={onValue}
      />,
    );
    const box = screen.getByRole('textbox', { name: 'Budget' });
    fireEvent.change(box, { target: { value: '12,5' } });
    expect(onValue).toHaveBeenLastCalledWith({ amountMinor: 1250, currency: 'EUR' });
    fireEvent.change(box, { target: { value: '' } });
    expect(onValue).toHaveBeenLastCalledWith(null);
    expect(minorUnitsOf('JPY')).toBe(1);
  });

  it('toggles multi-select choices and shows the error under the field', () => {
    const onValue = vi.fn();
    render(
      <Controlled
        field={{ key: 'x', label: 'Extras', kind: 'multi_select', options }}
        onValue={onValue}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Phone' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Laptop' }));
    expect(onValue).toHaveBeenLastCalledWith(['phone', 'laptop']);
    render(
      <CustomFieldControl
        field={{ key: 't', label: 'Title', kind: 'text' }}
        value={null}
        error="Title is required"
        onChange={() => undefined}
      />,
    );
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Title is required')).toBeTruthy();
  });
});
