import type { Project } from '@bemmoly/module-work/shared';
import { render, screen, within } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { backend, PROJECT_ID, Providers, testClient, useWorkflowBackend } from './testing.tsx';
import { WorkflowsList } from './workflows-list.tsx';

useWorkflowBackend({ beforeAll, afterAll, beforeEach, afterEach });

const project = { id: PROJECT_ID, key: 'PLT', name: 'Platform Core' } as Project;

function renderList() {
  render(
    <Providers client={testClient()}>
      <WorkflowsList project={project} editorPath={(id) => `/work/workflows/PLT/${id}`} />
    </Providers>,
  );
}

describe('WorkflowsList', () => {
  it('says when each workflow was published, not when it last changed', async () => {
    backend.workflow = { ...backend.workflow, publishedAt: new Date().toISOString() };
    renderList();
    const row = (await screen.findByText('Software workflow')).closest('[role="row"]');
    expect(screen.getByRole('columnheader', { name: 'Published' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Last change' })).toBeNull();
    expect(within(row as HTMLElement).getByText(/now|second|minute/i)).toBeTruthy();
  });

  it('says Never for a workflow that has not been published', async () => {
    backend.workflow = { ...backend.workflow, publishedVersion: 0, publishedAt: null };
    renderList();
    const row = (await screen.findByText('Software workflow')).closest('[role="row"]');
    expect(within(row as HTMLElement).getByText('Never')).toBeTruthy();
  });
});
