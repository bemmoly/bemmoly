import type { CodeLink, IssueDetail } from '@bemmoly/module-work/shared';
import {
  Button,
  CodeLinkRow,
  EmptyHint,
  ListCard,
  ListGroupLabel,
  SectionHeading,
  SkeletonRow,
} from '@bemmoly/ui';
import { useState } from 'react';
import { COMMITS_SHOWN, HOST_NAMES, pullSummary, useCodeLinks } from '../hooks/code-links.ts';

function Row({ link }: { link: CodeLink }) {
  return (
    <CodeLinkRow
      kind={link.kind}
      codeRef={link.ref}
      {...(link.kind === 'branch' ? {} : { title: link.title })}
      repository={link.repository}
      href={link.url}
      host={HOST_NAMES[link.hostKind]}
      state={link.state}
      checks={link.checks}
      review={link.review}
    />
  );
}

/**
 * Development: the pull requests, branches and commits that name this issue's key, with live
 * state, checks and review. Always shown, like Links; empty, it says how to link code. Rows
 * open the code host; nothing here is edited, since the host is where code changes.
 */
export function DevelopmentSection({
  issue,
  size,
}: {
  issue: IssueDetail;
  size: 'page' | 'panel';
}) {
  const { query, pulls, branches, commits } = useCodeLinks(issue.key);
  const [allCommits, setAllCommits] = useState(false);
  const shownCommits = allCommits ? commits : commits.slice(0, COMMITS_SHOWN);
  const groups = [pulls, branches, commits].filter((group) => group.length > 0).length;
  const label = (text: string, count: number) =>
    groups > 1 ? <ListGroupLabel>{`${text} · ${count}`}</ListGroupLabel> : null;

  return (
    <section aria-label="Development" aria-busy={query.isPending} className="flex flex-col gap-2">
      <SectionHeading title="Development" size={size} hint={pullSummary(pulls) || undefined} />
      {query.isPending && (
        <ListCard>
          <SkeletonRow />
        </ListCard>
      )}
      {query.isError && (
        <div className="flex items-center gap-3">
          <EmptyHint>Linked pull requests did not load.</EmptyHint>
          <Button size="xs" variant="ghost" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}
      {query.isSuccess && query.data.length === 0 && (
        <EmptyHint>Name {issue.key} in a branch, pull request or commit to link it here.</EmptyHint>
      )}
      {query.isSuccess && query.data.length > 0 && (
        <ListCard>
          {pulls.length > 0 && label('Pull requests', pulls.length)}
          {pulls.map((link) => (
            <Row key={link.id} link={link} />
          ))}
          {branches.length > 0 && label('Branches', branches.length)}
          {branches.map((link) => (
            <Row key={link.id} link={link} />
          ))}
          {commits.length > 0 && label('Commits', commits.length)}
          {shownCommits.map((link) => (
            <Row key={link.id} link={link} />
          ))}
          {commits.length > shownCommits.length && (
            <button
              type="button"
              onClick={() => setAllCommits(true)}
              className="flex min-h-9 w-full cursor-pointer items-center border-0 bg-transparent px-3 text-left font-sans text-13 text-tx-3 hover:bg-hover hover:text-tx-2 focus-ring-inset"
            >
              Show {commits.length - shownCommits.length} more
              {commits.length - shownCommits.length === 1 ? ' commit' : ' commits'}
            </button>
          )}
        </ListCard>
      )}
    </section>
  );
}
