import type { APIRoute } from 'astro';
import { INSTALL, RELEASE } from '../data/landing.ts';
import { PAGES } from '../data/pages.ts';
import { WHAT_YOU_GET } from '../data/self-hosting.ts';
import { UPCOMING } from '../lib/changelog.ts';
import { CONTRIBUTING_URL, REPO_URL, TECH_DESIGN_URL } from '../lib/links.ts';

/**
 * /llms.txt (https://llmstxt.org): the site in the shape language models read best. Built
 * from the same data as the pages, so it cannot drift from them, and it separates what ships
 * today from what is planned, as the pages do.
 */
export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const lines = [
    '# Bemmoly',
    '',
    '> Open source (MIT), self-hosted, AI-first work platform: issues, boards, sprints and docs',
    '> for a whole company, in one application image next to one Postgres on your own server,',
    '> with no per-seat pricing. Keep your work in-house.',
    '',
    `Bemmoly is built in the open at ${REPO_URL}. The current release is ${RELEASE.version}. It has`,
    'the foundation (the installer, the setup wizard, people, teams and roles, email and',
    'notifications, an audit log, backups, and updates and rollback from the app or one command)',
    'and the Work module: projects, issues with custom fields and visual workflows, Kanban and',
    'Scrum boards, the backlog and sprints, saved LQL filters and board metrics. An admin turns',
    'Work on in Settings › Modules. It installs on a fresh Linux VM (2 vCPU, 4 GB) with:',
    '',
    `    ${INSTALL}`,
    '',
    'Every install gets:',
    '',
    ...WHAT_YOU_GET.map(({ title, body }) => `- ${title}: ${body}`),
    '',
    '## What comes next',
    '',
    ...UPCOMING.map(({ version, title, scope }) => `- ${version} ${title}: ${scope}.`),
    '',
    '## Pages',
    '',
    ...PAGES.map(({ path, name, description }) => `- [${name}](${url(path)}): ${description}`),
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
