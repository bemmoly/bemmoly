/**
 * Copy for the landing page, from the DCLogic block and markup of
 * docs/design/mocks/Bemmoly Landing.dc.html. Changes from the mock are listed in README.md.
 */
import { INSTALL_COMMAND } from '../lib/links.ts';

export const RELEASE = {
  version: '0.1.0',
  note: 'In progress: setup wizard, eight themes, one-command upgrades',
};

export const PROOF_POINTS = [
  'MIT licensed',
  'Postgres only, no Redis or Elastic',
  'Imports from Jira and Confluence',
  'Any AI provider, or none',
];

export const FEATURES = [
  {
    g: 'WK',
    title: 'Work, from backlog to release',
    body: 'Scrum or Kanban per project. Epics, sprints, swimlanes, WIP limits, custom fields, a visual workflow editor, roadmap with forecasts.',
  },
  {
    g: 'DC',
    title: 'Docs, from RFC to handbook',
    body: "Spaces, page trees, templates, inline comments, live issue embeds that stay in sync, and Q&A across everything you've written.",
  },
  {
    g: 'AI',
    title: 'AI-first, not AI-bolted-on',
    body: 'Briefs, risk detection, planning, drafting and a command bar that previews before it acts. Works with any provider or a local model.',
  },
  {
    g: 'CF',
    title: 'Configurable at two levels',
    body: 'Org defaults with locks; project overrides for columns, lanes, cards, fields, workflows and estimation.',
  },
  {
    g: 'RB',
    title: 'Roles that make sense',
    body: 'Org admin, project admin, member, viewer, plus custom roles. SSO with group-to-team mapping. Audit log for everything.',
  },
  {
    g: 'TH',
    title: 'Themes, including yours',
    body: 'Eight presets and a brand-color builder with automatic contrast checks. Members can pick light or dark for themselves.',
  },
];

export const AI_POINTS = [
  'Morning brief: what changed, what needs you',
  'Sprint and flow risk, with one-click fixes',
  'Docs that catch their own inconsistencies with linked issues',
  'Bring your own provider, or a local model. Or none.',
];

export const STATS = [
  { value: '$0', label: 'per seat, forever. MIT license.' },
  { value: '~$20/mo', label: 'typical VM cost for a startup' },
  { value: '5 min', label: 'curl to first login' },
  { value: '1 cmd', label: 'to upgrade or roll back' },
];

/** The installer transcript (tech design §18), Postgres 18 and this release's version. */
export const TRANSCRIPT: readonly { text: string; tone: 'step' | 'done' }[] = [
  { text: '→ Detected Ubuntu 24.04, 2 vCPU, 4 GB', tone: 'step' },
  { text: '→ Installing Postgres 18 … done', tone: 'step' },
  { text: `→ Pulling bemmoly:${RELEASE.version} … done`, tone: 'step' },
  { text: '→ Requesting certificate for bemmoly.acmelabs.dev … done', tone: 'step' },
  { text: '→ Nightly backup scheduled 02:00 → /var/bemmoly/backups', tone: 'step' },
  { text: '✓ Bemmoly is running at https://bemmoly.acmelabs.dev', tone: 'done' },
  { text: '  Open it to create the first admin.', tone: 'done' },
];

export const INSTALL = INSTALL_COMMAND;

export const INSTALL_PATHS = [
  'Docker',
  'Helm chart',
  'Terraform for AWS, GCP, Hetzner',
  'Air-gapped install',
];

export const CONFIGS = [
  {
    title: 'Board settings',
    body: 'Columns mapped to statuses, WIP limits, default swimlanes, card fields, Scrum or Kanban.',
  },
  {
    title: 'Issue types and fields',
    body: 'Project-specific types like Incident, custom fields, AI-filled defaults, create-form layout.',
  },
  {
    title: 'Workflow editor',
    body: 'Visual statuses and transitions with conditions, validators and post-actions.',
  },
  {
    title: 'Roles and themes',
    body: 'Permission matrix with org locks; theme presets and custom brand colors.',
  },
];
