import type { APIRoute } from 'astro';
import { AI_POINTS, FEATURES, INSTALL, PROOF_POINTS, RELEASE } from '../data/landing.ts';
import { PAGES } from '../data/pages.ts';
import { CONTRIBUTING_URL, REPO_URL, TECH_DESIGN_URL } from '../lib/links.ts';

/**
 * /llms.txt (https://llmstxt.org): the site in the shape language models read best. Built
 * from the same data as the pages, so it cannot drift from them.
 */
export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(path, site).href;
  const lines = [
    '# Bemmoly',
    '',
    '> Open source (MIT), self-hosted, AI-first alternative to Jira and Confluence: issues and',
    '> docs for a whole company in one container next to one Postgres, with no per-seat pricing.',
    '',
    `Bemmoly is built in the open at ${REPO_URL}. The current release is ${RELEASE.version}`,
    `(${RELEASE.note.toLowerCase()}). It installs on a fresh VM with one command:`,
    '',
    `    ${INSTALL}`,
    '',
    `Key facts: ${PROOF_POINTS.join('; ')}.`,
    '',
    '## What it does',
    '',
    ...FEATURES.map(({ title, body }) => `- ${title}: ${body}`),
    '',
    '## AI',
    '',
    ...AI_POINTS.map((point) => `- ${point}`),
    '',
    '## Pages',
    '',
    ...PAGES.map(({ path, title, description }) => `- [${title}](${url(path)}): ${description}`),
    '',
    '## Optional',
    '',
    `- [Source code](${REPO_URL}): the repository, issues and plans.`,
    `- [Technical design](${TECH_DESIGN_URL}): architecture, modules, data model, AI runtime, installs.`,
    `- [Contributing](${CONTRIBUTING_URL}): the contract for changes by people and agents.`,
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
