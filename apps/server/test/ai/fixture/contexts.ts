import { AI_ROLES } from '@bemmoly/shared';
import { createContextWriter, type AiPolicy, type ContextWriter } from '@bemmoly/core';
import {
  COMMENTS,
  ISSUES,
  RFC,
  SPRINTS,
  TODAY,
  issueByKey,
  nameOf,
  type AcmeIssue,
  type AcmePage,
} from './acme.ts';

/*
 * The insight contexts for the Acme Labs sample, written with the kernel's context writer the
 * way the Work and Docs builders write theirs: ordered sections, every chunk a "[cN]" citation.
 */

const SHARE_ALL: AiPolicy = {
  enabled: true,
  shareContent: true,
  redactEmails: false,
  redactNames: false,
  excludedSpaceIds: [],
  excludedProjectIds: [],
  allowActions: true,
  perUserOptOutAllowed: false,
  optedOutUserIds: [],
  actorOptedOut: false,
  budgetState: 'unlimited',
  assignedRoles: AI_ROLES,
  availableRoles: AI_ROLES,
};

export interface EvalContext {
  /** The prompt's variables, {{context}} included. */
  variables: Record<string, string>;
  /** Citation ids the context offered; a cite outside them is invented. */
  offered: Set<string>;
}

function finish(writer: ContextWriter, variables: Record<string, string>): EvalContext {
  const built = writer.build({}, variables);
  return {
    variables: { ...variables, context: built.text },
    offered: new Set(built.citations.map((citation) => citation.id)),
  };
}

const issueLine = (issue: AcmeIssue) =>
  `${issue.key} · ${issue.title} · ${issue.status} · ${nameOf(issue.assignee)} · ${issue.points} points`;

function citeIssue(writer: ContextWriter, issue: AcmeIssue, withBody = true) {
  writer.cite({
    kind: 'issue',
    objectId: issue.key,
    label: issue.key,
    href: `/work/issues/${issue.key}`,
    line: issueLine(issue),
    body: withBody ? issue.description : null,
    counts: 'issues',
  });
}

function citeSection(writer: ContextWriter, page: AcmePage, index: number) {
  const section = page.sections[index]!;
  writer.cite({
    kind: 'section',
    objectId: page.id,
    label: section.heading ?? page.title,
    location: section.heading,
    href: `/docs/p/${page.id}#${section.anchor}`,
    line: `Section "${section.heading ?? 'Introduction'}"`,
    body: section.paragraphs.join('\n'),
    counts: 'sections',
  });
}

/** work.issue_summary for PLT-204, as the Issue mock's summary card reads it. */
export function issueSummaryContext(): EvalContext {
  const issue = issueByKey('PLT-204')!;
  const writer = createContextWriter({ policy: SHARE_ALL });
  writer.heading(`Issue ${issue.key}`);
  citeIssue(writer, issue);
  writer.heading('Blocks');
  for (const key of ['PLT-211', 'PLT-219']) citeIssue(writer, issueByKey(key)!, false);
  writer.heading('Latest comments');
  writer.cite({
    kind: 'comment',
    objectId: 'ic-1',
    label: "Priya N.'s comment",
    line: 'Priya N. on 2026-10-07',
    body: 'Flag TTL in the RFC says 15 min, the code says 30. Can we align before cutover?',
    counts: 'comments',
  });
  writer.heading('History since the last summary');
  writer.cite({
    kind: 'history',
    objectId: 'h-1',
    label: 'Status change',
    line: 'Aisha K. changed status In progress → Code review on 2026-10-08',
  });
  writer.heading('Linked docs');
  writer.cite({
    kind: 'page',
    objectId: RFC.id,
    label: RFC.title,
    location: 'TL;DR',
    line: `${RFC.title} (TL;DR below)`,
    body: 'Rollback is a flag flip; sessions stay valid for 15 minutes after the flag is off.',
    counts: 'docs',
  });
  return finish(writer, { key: issue.key, title: issue.title });
}

/** work.sprint_pulse for Sprint 14: PLT-204's review holds two issues. */
export function sprintPulseContext(): EvalContext {
  const sprint = SPRINTS[0];
  const writer = createContextWriter({ policy: SHARE_ALL });
  writer.heading(sprint.name);
  writer.cite({
    kind: 'sprint',
    objectId: sprint.id,
    label: sprint.name,
    line: `${sprint.name} · ${sprint.start} to ${sprint.end} · ${sprint.committedPoints} points committed, ${sprint.donePoints} done · today ${TODAY}`,
  });
  writer.heading('Issues');
  for (const issue of ISSUES.filter((candidate) => candidate.sprint === sprint.name)) {
    const blocked = issue.blockedBy.length ? ` · blocked by ${issue.blockedBy.join(', ')}` : '';
    writer.cite({
      kind: 'issue',
      objectId: issue.key,
      label: issue.key,
      line: `${issueLine(issue)} · idle ${issue.idleDays} days${blocked}`,
      counts: 'issues',
    });
  }
  return finish(writer, { sprint: sprint.name, project: 'Platform', today: TODAY });
}

/** docs.tldr for the Auth service RFC: sections, embedded issues, open comments. */
export function pageTldrContext(): EvalContext {
  const writer = createContextWriter({ policy: SHARE_ALL });
  writer.heading(`Page "${RFC.title}" (${RFC.status})`);
  RFC.sections.forEach((_, index) => citeSection(writer, RFC, index));
  writer.heading('Issues on the page');
  for (const key of RFC.issues) citeIssue(writer, issueByKey(key)!, false);
  writer.heading('Open comments');
  for (const comment of COMMENTS.filter((c) => c.page === RFC.id && !c.resolved)) {
    writer.cite({
      kind: 'comment',
      objectId: comment.id,
      label: `${nameOf(comment.author)}'s comment`,
      location: comment.quote,
      line: `${nameOf(comment.author)} on ${comment.at}${comment.quote ? ` about "${comment.quote}"` : ''}`,
      body: comment.body,
      counts: 'comments',
    });
  }
  return finish(writer, { title: RFC.title });
}

/** docs.consistency for the RFC: each issue it names, then the paragraphs that name it. */
export function consistencyContext(): EvalContext {
  const writer = createContextWriter({ policy: SHARE_ALL });
  writer.heading(`Page "${RFC.title}" (${RFC.status})`);
  for (const key of RFC.issues) {
    const issue = issueByKey(key)!;
    writer.heading(`Issue ${key}`);
    citeIssue(writer, issue);
    RFC.sections.forEach((section, sectionIndex) => {
      section.paragraphs.forEach((text, index) => {
        if (!text.includes(key)) return;
        const heading = section.heading ?? 'Introduction';
        const paragraph = RFC.sections
          .slice(0, sectionIndex)
          .reduce((count, earlier) => count + earlier.paragraphs.length, index);
        writer.cite({
          kind: 'section',
          objectId: RFC.id,
          label: section.heading ?? RFC.title,
          location: `${heading}, paragraph ${paragraph}`,
          line: `Page "${RFC.title}", section "${heading}", paragraph ${paragraph}`,
          body: text,
          counts: 'paragraphs',
        });
      });
    });
  }
  return finish(writer, { title: RFC.title });
}

/** ai.brief for Jonas M.: a review waits on him and his two issues hang on it. */
export function briefContext(): EvalContext {
  const writer = createContextWriter({ policy: SHARE_ALL });
  writer.heading('Waiting on you');
  writer.cite({
    kind: 'issue',
    objectId: 'PLT-204',
    label: 'PLT-204',
    line: 'PLT-204 · Session store migration to Postgres · Code review · PR #4821 waits on your review since 2026-10-08',
  });
  writer.heading('Your issues');
  for (const key of ['PLT-211', 'PLT-219']) {
    const issue = issueByKey(key)!;
    writer.cite({
      kind: 'issue',
      objectId: key,
      label: key,
      line: `${issueLine(issue)} · blocked by PLT-204`,
    });
  }
  writer.heading('Comments');
  writer.cite({
    kind: 'comment',
    objectId: 'cm-3',
    label: "Priya N.'s comment",
    line: `Priya N. on ${RFC.title}, 2026-10-10`,
    body: 'Looks good to me once the TTL question is settled.',
  });
  writer.heading('Sprint 14');
  writer.cite({
    kind: 'sprint',
    objectId: 's-14',
    label: 'Sprint 14',
    line: 'Sprint 14 · ends 2026-10-16 · 9 of 23 points done',
  });
  return finish(writer, { person: 'Jonas M.', since: '2026-10-11', today: TODAY });
}
