import type { Project } from '@bemmoly/module-work/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  backend,
  PROJECT_ID,
  Providers,
  STATUS,
  testClient,
  useWorkflowBackend,
  WORKFLOW_ID,
} from './testing.tsx';
import { WorkflowEditor } from './workflow-editor.tsx';

useWorkflowBackend({ beforeAll, afterAll, beforeEach, afterEach });

const project = {
  id: PROJECT_ID,
  key: 'PLT',
  name: 'Platform Core',
} as Project;

async function openEditor() {
  render(
    <Providers client={testClient()}>
      <WorkflowEditor project={project} workflowId={WORKFLOW_ID} listPath="/work/workflows/PLT" />
    </Providers>,
  );
  return screen.findByRole('group', { name: 'Software workflow' });
}

/** Opens a Select by its accessible name and picks an option. */
async function choose(select: HTMLElement, option: string) {
  fireEvent.click(select);
  fireEvent.click(await screen.findByRole('option', { name: new RegExp(option) }));
}

const lastSaved = () => backend.saved[backend.saved.length - 1];

describe('WorkflowEditor', () => {
  it('adds a transition from the selected status and saves it', async () => {
    const canvas = await openEditor();
    fireEvent.click(within(canvas).getByRole('button', { name: /^In progress/ }));
    const panel = screen.getByRole('complementary', { name: 'Status' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add transition' }));
    await choose(within(panel).getByRole('combobox', { name: 'Add transition to' }), 'Done');

    const label = await within(canvas).findByRole('button', { name: /^Done/, pressed: true });
    expect(label.tagName).toBe('BUTTON');
    expect(screen.getByRole('complementary', { name: 'Transition' })).toBeTruthy();
    await waitFor(() => expect(lastSaved()?.transitions).toHaveLength(2), { timeout: 3000 });
    expect(lastSaved()?.transitions[1]).toMatchObject({
      fromStatusId: STATUS.progress,
      toStatusId: STATUS.done,
      name: 'Done',
    });
    expect(screen.getByText(/1 unpublished change\b/)).toBeTruthy();
  });

  it('adds a condition from the registry and edits its argument', async () => {
    const canvas = await openEditor();
    fireEvent.click(within(canvas).getByRole('button', { name: 'Start work' }));
    const panel = screen.getByRole('complementary', { name: 'Transition' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Add condition' }));
    await choose(within(panel).getByRole('combobox', { name: 'Add condition' }), 'Field is set');

    expect(within(panel).getByText('Condition')).toBeTruthy();
    expect(within(panel).getByText('Fill in Field.')).toBeTruthy();
    fireEvent.change(within(panel).getByRole('textbox', { name: 'Field *' }), {
      target: { value: 'pullRequest' },
    });
    expect(within(panel).getByText('Field is set: pullRequest')).toBeTruthy();
    expect(within(panel).queryByText('Fill in Field.')).toBeNull();

    await waitFor(
      () =>
        expect(lastSaved()?.transitions[0]?.rules.conditions).toEqual([
          { name: 'field_set', args: { field: 'pullRequest' } },
        ]),
      { timeout: 3000 },
    );
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove Field is set' }));
    expect(within(panel).queryByText('Condition')).toBeNull();
  });

  it('deletes the focused status at once and offers Undo', async () => {
    const canvas = await openEditor();
    const node = within(canvas).getByRole('button', { name: /^Backlog/ });
    fireEvent.keyDown(node, { key: 'Delete' });
    await waitFor(() =>
      expect(within(canvas).queryByRole('button', { name: /^Backlog/ })).toBeNull(),
    );
    expect(within(canvas).queryByRole('button', { name: 'Start work' })).toBeNull();
    expect(await screen.findByText('Status "Backlog" deleted')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await within(canvas).findByRole('button', { name: /^Backlog/ })).toBeTruthy();
    expect(within(canvas).getByRole('button', { name: 'Start work' })).toBeTruthy();
  });

  it('shows how many issues sit in each status', async () => {
    const canvas = await openEditor();
    expect(await within(canvas).findByText(/· 4 issues/)).toBeTruthy();
    expect(within(canvas).getByText(/· 9 issues/)).toBeTruthy();
  });

  it('nudges the focused status with the arrow keys', async () => {
    const canvas = await openEditor();
    const node = within(canvas).getByRole('button', { name: /^Done/ });
    fireEvent.keyDown(node, { key: 'ArrowRight' });
    fireEvent.keyDown(node, { key: 'ArrowRight', shiftKey: true });
    await waitFor(
      () => expect(lastSaved()?.statuses.find((status) => status.id === STATUS.done)?.x).toBe(501),
      { timeout: 3000 },
    );
    expect(node.getAttribute('aria-pressed')).toBe('true');
  });
});
