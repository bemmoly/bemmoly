import { formLayoutSchema, type CustomFieldDefinition } from '@bemmoly/shared';
import { Button } from '@bemmoly/ui';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomForm } from './custom-form.tsx';
import { useCustomForm } from './use-custom-form.ts';

const field = (
  key: string,
  kind: CustomFieldDefinition['kind'],
  extra: Partial<CustomFieldDefinition> = {},
): CustomFieldDefinition => ({
  id: `0199c7a0-0000-7000-8000-00000000000${key.length}`,
  moduleId: 'helpdesk',
  entityType: 'ticket',
  key,
  label: key[0]!.toUpperCase() + key.slice(1),
  description: null,
  kind,
  required: false,
  options: [],
  validation: {},
  defaultValue: null,
  visibleTo: [],
  editableBy: [],
  position: 0,
  archived: false,
  ...extra,
});

const FIELDS = [
  field('urgent', 'boolean', { defaultValue: false }),
  field('reason', 'text', { required: true }),
  field('title', 'text', { required: true }),
];

const sections = formLayoutSchema.parse([
  {
    id: 'main',
    title: 'Request',
    items: [
      { field: 'title' },
      { field: 'urgent' },
      { field: 'reason', when: [{ field: 'urgent', operator: 'equals', value: true }] },
    ],
  },
]);

function Harness({ onSubmit }: { onSubmit: (values: Record<string, unknown>) => Promise<void> }) {
  const state = useCustomForm({ form: { sections }, fields: FIELDS, onSubmit });
  return (
    <CustomForm
      aria-label="New request"
      state={state}
      fields={FIELDS}
      actions={
        <Button type="submit" variant="primary">
          Send request
        </Button>
      }
    />
  );
}

describe('CustomForm', () => {
  it('shows conditional fields, validates like the kernel, and sends only shown values', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.queryByRole('textbox', { name: /Reason/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Title is required')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: /Title/ }), {
      target: { value: 'New laptop' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Urgent' }));
    expect(screen.getByRole('textbox', { name: /Reason/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Reason is required')).toBeTruthy();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Urgent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ title: 'New laptop', urgent: false }),
    );
  });
});
