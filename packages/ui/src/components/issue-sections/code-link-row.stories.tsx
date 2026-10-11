import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeLinkRow } from './code-link-row.tsx';
import { EmptyHint, IssueSection, ListCard, SectionHeading } from './section.tsx';

const meta = {
  title: 'Components/IssueSections/Development',
  component: CodeLinkRow,
} satisfies Meta<typeof CodeLinkRow>;

export default meta;

type Story = StoryObj<typeof meta>;

const GH = 'https://github.com/acme/api';

/** The Development section: linked pull requests in every state, a branch and a commit. */
export const Development: Story = {
  args: { kind: 'pull_request', codeRef: '#4821', href: GH, host: 'GitHub' },
  render: () => (
    <div className="flex w-194 max-w-full flex-col gap-5 bg-sunken p-4">
      <IssueSection heading={<SectionHeading title="Development" hint="3 pull requests" />}>
        <ListCard>
          <CodeLinkRow
            kind="pull_request"
            codeRef="#4821"
            title="Session store to Postgres"
            repository="acme/api"
            href={`${GH}/pull/4821`}
            host="GitHub"
            state="open"
            checks="passing"
            review="review_required"
          />
          <CodeLinkRow
            kind="pull_request"
            codeRef="#4833"
            title="Flag TTL from config"
            repository="acme/api"
            href={`${GH}/pull/4833`}
            host="GitHub"
            state="draft"
            checks="pending"
          />
          <CodeLinkRow
            kind="pull_request"
            codeRef="#4790"
            title="Dual-write sessions"
            repository="acme/api"
            href={`${GH}/pull/4790`}
            host="GitHub"
            state="merged"
            checks="passing"
            review="approved"
          />
          <CodeLinkRow
            kind="pull_request"
            codeRef="!57"
            title="Throttle the export endpoint"
            repository="acme/platform/web"
            href="https://gitlab.acme.dev/acme/platform/web/-/merge_requests/57"
            host="GitLab"
            state="closed"
            checks="failing"
            review="changes_requested"
          />
          <CodeLinkRow
            kind="branch"
            codeRef="feat/plt-204-pg-sessions"
            repository="acme/api"
            href={`${GH}/tree/feat/plt-204-pg-sessions`}
            host="GitHub"
          />
          <CodeLinkRow
            kind="commit"
            codeRef="a1b2c3d"
            title="Rate limit sign-in per account"
            repository="acme/api"
            href={`${GH}/commit/a1b2c3d`}
            host="GitHub"
          />
        </ListCard>
      </IssueSection>
      <IssueSection heading={<SectionHeading title="Development" />}>
        <EmptyHint>
          Name PLT-204 in a branch, pull request or commit and it shows up here.
        </EmptyHint>
      </IssueSection>
    </div>
  ),
};
