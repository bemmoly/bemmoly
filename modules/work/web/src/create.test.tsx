import { writePreference } from '@bemmoly/core-web';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import dialogs from './create.tsx';
import { id, project, Providers, startServer } from './issue/test-support.tsx';
import { projectKeyInPath } from './shared/project-in-path.ts';

const server = startServer();

/** Listed first, so it is what a person with no last project would start in. */
const other = { ...project, id: id(90), key: 'OPS', name: 'Operations' };

const NewIssue = dialogs['work.create-issue']!;

function openOver(path: string) {
  window.history.replaceState(null, '', path);
  server.use(
    http.get('*/api/v1/work/projects', () =>
      HttpResponse.json({ items: [other, project], nextCursor: null }),
    ),
    http.get('*/api/v1/work/projects/:key/sprints', () => HttpResponse.json({ items: [] })),
  );
  render(
    <Providers>
      <NewIssue onClose={() => undefined} onCreated={() => undefined} />
    </Providers>,
  );
}

describe('New issue from the shell', () => {
  it('starts in the project the address names, before any screen has remembered it', async () => {
    openOver('/work/board/PLT');
    const picker = await screen.findByRole('combobox', { name: 'Project' });
    expect(picker.textContent).toContain('Platform Core');
  });

  it('keeps its form and open picker when a project is remembered behind it', async () => {
    openOver('/work/board/PLT');
    fireEvent.click(await screen.findByRole('combobox', { name: 'Project' }));
    const option = await screen.findByRole('option', { name: /Operations/ });
    // The board behind the dialog finishes loading and remembers a project.
    act(() => writePreference('work.project', 'OPS'));
    expect(option.isConnected).toBe(true);
    expect(screen.getByRole('combobox', { name: 'Project' }).textContent).toContain(
      'Platform Core',
    );
  });
});

describe('projectKeyInPath', () => {
  it('reads the project from a project screen or an issue key, and nothing elsewhere', () => {
    expect(projectKeyInPath('/work/board/PLT')).toBe('PLT');
    expect(projectKeyInPath('/work/backlog/plt')).toBe('PLT');
    expect(projectKeyInPath('/work/issue/PLT-204')).toBe('PLT');
    expect(projectKeyInPath('/work/settings/PLT/fields')).toBe('PLT');
    expect(projectKeyInPath('/work/my-issues')).toBeUndefined();
    expect(projectKeyInPath('/docs/s/ENG')).toBeUndefined();
  });
});
