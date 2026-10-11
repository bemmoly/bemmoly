import { LeaveGuardProvider, type LeaveGuardHook } from '@bemmoly/core-web';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddDialog } from './add-dialog.tsx';

afterEach(cleanup);

describe('AddDialog', () => {
  it('asks before a move away drops a typed name', async () => {
    const shell = { attempt: () => undefined as void, when: false };
    const leave = vi.fn();
    const hook: LeaveGuardHook = ({ when }) => {
      const [blocked, setBlocked] = useState(false);
      shell.when = when;
      shell.attempt = () => setBlocked(when);
      return { blocked, to: '/work/board', stay: () => setBlocked(false), leave };
    };
    render(
      <LeaveGuardProvider hook={hook}>
        <AddDialog
          open
          title="Add issue type"
          choiceLabel="Level"
          choices={[{ value: 'standard', label: 'Standard' }]}
          initialChoice="standard"
          busy={false}
          error={null}
          confirmLabel="Add issue type"
          onSubmit={vi.fn()}
          onClose={vi.fn()}
        />
      </LeaveGuardProvider>,
    );
    expect(shell.when).toBe(false);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Spike' } });
    expect(shell.when).toBe(true);
    act(() => shell.attempt());
    const confirm = await screen.findByRole('dialog', { name: 'Leave without creating "Spike"?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Leave without creating' }));
    expect(leave).toHaveBeenCalledOnce();
  });
});
