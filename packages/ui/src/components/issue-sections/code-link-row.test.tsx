import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectAccessible, expectFocusRing } from '../../testing/a11y.ts';
import { CodeLinkRow } from './code-link-row.tsx';
import { ListCard } from './section.tsx';

describe('CodeLinkRow', () => {
  it('draws a pull request with its state, checks and review in words', async () => {
    const { container } = render(
      <ListCard>
        <CodeLinkRow
          kind="pull_request"
          codeRef="#4821"
          title="Session store to Postgres"
          repository="acme/api"
          href="https://github.com/acme/api/pull/4821"
          host="GitHub"
          state="open"
          checks="failing"
          review="approved"
        />
        <CodeLinkRow
          kind="pull_request"
          codeRef="!57"
          title="Throttle exports"
          href="https://gitlab.acme.dev/acme/web/-/merge_requests/57"
          host="GitLab"
          state="merged"
        />
        <CodeLinkRow
          kind="branch"
          codeRef="feat/plt-204-pg-sessions"
          href="https://github.com/acme/api/tree/feat/plt-204-pg-sessions"
          host="GitHub"
        />
        <CodeLinkRow
          kind="commit"
          codeRef="a1b2c3d"
          title="Rate limit sign-in per account"
          href="https://github.com/acme/api/commit/a1b2c3d"
          host="GitHub"
        />
      </ListCard>,
    );
    await expectAccessible(container);
    const pull = screen.getByRole('link', { name: /#4821 Session store to Postgres/ });
    expect(pull.getAttribute('target')).toBe('_blank');
    expect(pull.getAttribute('rel')).toBe('noreferrer');
    expect(pull.textContent).toContain('Session store to Postgres');
    expect(pull.textContent).toContain('Open');
    expect(pull.textContent).toContain('Approved');
    expect(pull.textContent).toContain('(opens on GitHub)');
    expect(screen.getByRole('img', { name: 'Checks failing' })).toBeTruthy();
    expectFocusRing(pull);
    expect(screen.getByRole('link', { name: /!57/ }).textContent).toContain('Merged');
    const branch = screen.getByRole('link', { name: /feat\/plt-204-pg-sessions/ });
    expect(branch.textContent).not.toMatch(/Open|Merged/);
  });
});
