/**
 * Copy for the landing page, from the DCLogic block and markup of
 * docs/design/mocks/Bemmoly Landing.dc.html. Changes from the mock are listed in README.md.
 */
import { LATEST } from '../lib/changelog.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';
import type { Availability } from './topics.ts';

/** The newest release, from the release notes; the pill, transcript and bundle names use it. */
export const RELEASE = {
  version: LATEST.version,
  note: 'Out now: issues, boards, backlog and sprints',
};

export const PROOF_POINTS = [
  'MIT licensed',
  'Postgres only, no Redis or Elastic',
  'Imports from Jira and Confluence in 0.5',
  'Any AI provider, or none, from 0.4',
];

export interface Feature {
  g: string;
  title: string;
  body: string;
  /** Every card carries a badge, so nothing planned reads as shipped (topics.ts). */
  status: Availability;
}

export const FEATURES: readonly Feature[] = [
  {
    g: 'WK',
    title: 'Work, from backlog to release',
    body: 'Scrum or Kanban per project. Epics, sprints, swimlanes, WIP limits, custom fields, a visual workflow editor, saved filters and ⌘K search. A roadmap with forecasts follows in 0.5.',
    status: 'now',
  },
  {
    g: 'DC',
    title: 'Docs, from RFC to handbook',
    body: 'Spaces, page trees, templates, inline comments and live issue embeds that stay in sync, in the same app as the work they describe.',
    status: 'docs',
  },
  {
    g: 'AI',
    title: 'AI-first, not AI-bolted-on',
    body: 'Briefs, risk detection, planning, drafting, Q&A across everything you have written, and a command bar that previews before it acts. Any provider, a local model, or none.',
    status: 'ai',
  },
  {
    g: 'CF',
    title: 'Configurable at two levels',
    body: 'Org defaults, and project overrides for issue types, fields, workflows, columns, lanes, cards and estimation, each one reset with a click.',
    status: 'now',
  },
  {
    g: 'RB',
    title: 'Roles that make sense',
    body: 'Org admin, project admin, member, viewer, plus custom roles, with org locks on what each may change. An audit log of who changed what. SSO in 0.5.',
    status: 'now',
  },
  {
    g: 'TH',
    title: 'Themes, including yours',
    body: 'Eight presets and a brand-color builder with automatic contrast checks. Members can pick light or dark for themselves.',
    status: 'now',
  },
];

export const AI_POINTS = [
  'Morning brief: what changed, what needs you',
  'Sprint and flow risk, with fixes you confirm',
  'Docs that catch their own inconsistencies with linked issues',
  'Bring your own provider, or a local model. Or none.',
];

export const STATS = [
  { value: '$0', label: 'per seat, forever. MIT license.' },
  { value: '$5–25', label: 'a month for the 2 vCPU, 4 GB VM it needs' },
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
  'Docker Compose',
  'Your own Postgres',
  'Air-gapped bundle, untested offline',
  'Helm and Terraform in 1.0',
];

export const CONFIGS = [
  {
    title: 'Board settings',
    demo: '/demo/work/settings/PLT/board',
    body: 'Columns mapped to statuses, WIP limits, default swimlanes, card fields, Scrum or Kanban.',
  },
  {
    title: 'Issue types and fields',
    demo: '/demo/work/settings/PLT/issue-types',
    body: 'Project-specific types like Incident, custom fields and the create-form layout, overriding the org defaults or reset to them.',
  },
  {
    title: 'Workflow editor',
    demo: '/demo/work/workflows/PLT',
    body: 'Visual statuses and transitions with conditions, validators and post-actions.',
  },
  {
    title: 'Roles and themes',
    demo: '/demo/settings/roles',
    body: 'Permission matrix with org locks; theme presets and custom brand colors.',
  },
];
