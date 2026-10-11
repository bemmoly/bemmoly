import type { APIRoute } from 'astro';
import { AGENT_PROMPT_PATH } from '../data/agent-prompt.ts';
import { INSTALL, RELEASE } from '../data/landing.ts';
import { DEMO_PAGE, PAGES } from '../data/pages.ts';
import { WHAT_YOU_GET } from '../data/self-hosting.ts';
import { UPCOMING } from '../lib/changelog.ts';
import { CONTRIBUTING_URL, REPO_URL, TECH_DESIGN_URL } from '../lib/links.ts';

/**
 * /llms.txt (https://llmstxt.org): the site in the shape language models read best. Built
 * from the same data as the pages, so it cannot drift from them, and it separates what ships
 * today from what is coming soon, as the pages do.
 */
export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const lines = [
    '# Bemmoly',
    '',
    '> Open source (MIT), self-hosted work platform: issues, boards, sprints and docs for a whole',
    '> company, in one application image next to one Postgres on your own server. No subscription,',
    '> no seat limits, no in-app purchases. Your work. Your platform.',
    '',
    `Bemmoly is built in the open at ${REPO_URL}. The current release is ${RELEASE.version}. It has`,
    'the foundation (the installer, the setup wizard, people, teams and roles, single sign-on',
    'with any OpenID Connect provider or SAML 2.0 and SCIM 2.0 provisioning at /scim/v2, email',
    'and notifications, an audit log, backups, updates and rollback from the app or one command,',
    'and an MCP server at /mcp so AI clients can work in the workspace with your permissions),',
    'the Work module (projects, issues with custom fields and visual workflows, Kanban and Scrum',
    'boards, the backlog and sprints, saved LQL filters, board metrics, a roadmap of epics on a',
    'timeline and automation rules) and the Docs module',
    '(spaces, a live collaborative editor with image uploads, comments, version history, live',
    'issue chips, Markdown and HTML export, and Markdown folder import). An admin brings work in',
    'from Settings › Import: Import from Jira (Cloud or Data Center) and CSV files into Work,',
    'Import from Confluence (Cloud, Data Center or a space export) into Docs, with a preview',
    'before anything is written and a report at the end. AI shipped in 0.5 and is optional:',
    'it is off until an admin turns it on, works with a provider from the models.dev catalog or a',
    'model on your own network, and offers summaries that cite their sources, answers from your',
    'docs, help in the editor and plans from the command palette that run only when confirmed.',
    'Admins can send outgoing webhooks signed with HMAC-SHA256, link pull requests, branches and',
    'commits from GitHub or GitLab to issues, and pick one of five themes in light and dark with',
    'their own brand colour and logo.',
    'Modules start off; an admin turns them on in Settings › Manage modules. It installs on a',
    'Linux VM (at least 1 vCPU and 2 GB) with one command, or runs with Docker Compose, a Helm',
    `chart or the Terraform module; the guide is ${url('/self-hosting#install')}:`,
    '',
    `    ${INSTALL}`,
    '',
    `To have a coding agent install it, give it the prompt at ${url(AGENT_PROMPT_PATH)}.`,
    '',
    'Every install gets:',
    '',
    ...WHAT_YOU_GET.map(({ title, body }) => `- ${title}: ${body}`),
    '',
    '## Coming soon',
    '',
    ...UPCOMING.map(({ title, scope }) => `- ${title}: ${scope}.`),
    '',
    '## Pages',
    '',
    ...[...PAGES, DEMO_PAGE].map(
      ({ path, name, description }) => `- [${name}](${url(path)}): ${description}`,
    ),
    '',
    '## Optional',
    '',
    `- [Release feed](${url('/changelog.xml')}): RSS, one item per release.`,
    `- [Source code](${REPO_URL}): the repository, issues and plans.`,
    `- [Technical design](${TECH_DESIGN_URL}): architecture, modules, data model, AI runtime, installs.`,
    `- [Contributing](${CONTRIBUTING_URL}): the contract for changes by people and agents.`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
