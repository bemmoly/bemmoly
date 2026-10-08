import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectAccessible } from '../../testing/a11y.ts';
import { ConfirmChange } from './confirm-change.tsx';
import { SettingsSection, type SettingsSectionProps } from './settings-section.tsx';
import { SettingsValue, SettingsValues } from './settings-values.tsx';
import { UnsavedChangesBar } from './unsaved-bar.tsx';

function section(props: Partial<SettingsSectionProps>) {
  const handlers = { onEdit: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() };
  const view = render(
    <SettingsSection title="Retention" {...handlers} {...props}>
      {props.mode === 'edit' ? (
        <input aria-label="Daily" defaultValue="7" />
      ) : (
        <SettingsValues>
          <SettingsValue label="Daily">7 kept</SettingsValue>
        </SettingsValues>
      )}
    </SettingsSection>,
  );
  return { ...view, ...handlers };
}

describe('SettingsSection edit pattern', () => {
  it('reads as label and value rows with an Edit action', async () => {
    const { container, onEdit } = section({ mode: 'read' });
    expect(screen.getByRole('region', { name: 'Retention' })).toBeDefined();
    expect(screen.getByRole('term').textContent).toBe('Daily');
    expect(screen.getByRole('definition').textContent).toBe('7 kept');
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Retention' }));
    expect(onEdit).toHaveBeenCalledOnce();
    await expectAccessible(container);
  });

  it('disables Edit with the reason when the section is locked', () => {
    section({ mode: 'read', locked: 'Paused while Bemmoly is in maintenance' });
    const edit = screen.getByRole('button', { name: 'Edit Retention' }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    expect(edit.title).toBe('Paused while Bemmoly is in maintenance');
  });

  it('keeps Save disabled until something changed', () => {
    section({ mode: 'edit', dirty: false });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No changes yet.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit Retention' })).toBeNull();
  });

  it('saves on Save or Enter when dirty, and cancels', () => {
    const { onSave, onCancel } = section({ mode: 'edit', dirty: true });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.submit(screen.getByRole('textbox', { name: 'Daily' }));
    expect(onSave).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('stays a plain panel without a mode', () => {
    render(<SettingsSection title="Theme">content</SettingsSection>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ConfirmChange', () => {
  const base = {
    open: true,
    title: 'Remove the S3 destination?',
    consequences: ['New backups stop going to acme-backups.'],
    confirmLabel: 'Remove destination',
  };

  it('states what happens and needs the typed word before confirming', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmChange
        {...base}
        confirmWord="acme-backups"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('New backups stop going to acme-backups.')).toBeDefined();
    const confirm = screen.getByRole('button', { name: 'Remove destination' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    const field = screen.getByLabelText(/to confirm/);
    fireEvent.change(field, { target: { value: 'acme' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(field, { target: { value: 'acme-backups' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('confirms straight away when no word is asked for, and cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmChange {...base} tone="caution" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove destination' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders nothing while closed', () => {
    render(<ConfirmChange {...base} open={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('UnsavedChangesBar', () => {
  const sections = [
    { id: 'schedule', title: 'Schedule' },
    { id: 'retention', title: 'Retention' },
  ];

  it('names the sections with links and discards all', () => {
    const onDiscardAll = vi.fn();
    render(<UnsavedChangesBar sections={sections} onDiscardAll={onDiscardAll} />);
    const bar = screen.getByRole('status', { name: 'Unsaved changes' });
    expect(bar.textContent).toContain('Schedule and Retention');
    expect(screen.getByRole('link', { name: 'Retention' }).getAttribute('href')).toBe('#retention');
    fireEvent.click(screen.getByRole('button', { name: 'Discard all' }));
    expect(onDiscardAll).toHaveBeenCalledOnce();
  });

  it('asks to stay or leave when the person navigates away', () => {
    const onStay = vi.fn();
    const onLeave = vi.fn();
    render(
      <UnsavedChangesBar
        sections={sections.slice(0, 1)}
        leaving
        onDiscardAll={vi.fn()}
        onStay={onStay}
        onLeave={onLeave}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('Leave without saving?');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and leave' }));
    expect(onStay).toHaveBeenCalledOnce();
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it('is absent with nothing unsaved', () => {
    const { container } = render(<UnsavedChangesBar sections={[]} onDiscardAll={vi.fn()} />);
    expect(container.textContent).toBe('');
  });
});
