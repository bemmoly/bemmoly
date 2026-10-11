/**
 * The "Other ways to run it" cards on /self-hosting: every way to run Bemmoly other than the
 * one command, titled by the reader's situation. Commands follow deploy/ (the Compose file and
 * env template, the installer's options). A way that is not shipped and tested says "Coming
 * soon" and shows no command.
 */
import type { SiteIconName } from '../lib/icons.ts';
import { COMPOSE_EDIT, COMPOSE_FILES, COMPOSE_START } from './compose.ts';
import type { StatusKey } from './self-hosting.ts';

/** Where the chooser can point: a card id, or the one command. */
export type PathId = 'install' | 'compose' | 'own-postgres' | 'helm' | 'terraform';

export interface PathStep {
  /** Commands with $ prompts; only the commands are copied. */
  code: string;
  label: string;
}

export interface PathOption {
  id: Exclude<PathId, 'install'>;
  /** A drawn icon from the product's set, never letters in a box. */
  icon: SiteIconName;
  title: string;
  status: StatusKey;
  body: string;
  /** One block per step, each with its own Copy button, in the order they must run. */
  steps?: readonly PathStep[];
  note?: string;
  link?: { label: string; href: string };
  /** Spans the grid. */
  wide?: boolean;
}

export const PATHS: readonly PathOption[] = [
  {
    id: 'compose',
    icon: 'box',
    title: 'I already run Docker Compose',
    status: 'available',
    body: 'Use the Compose file and env template the installer writes. Postgres, the HTTPS proxy and the in-app updater are Compose profiles you can leave out.',
    steps: [
      { code: COMPOSE_FILES, label: '1. Put the files in /var/bemmoly' },
      { code: COMPOSE_EDIT, label: '2. Replace every @…@ placeholder in .env' },
      { code: COMPOSE_START, label: '3. Start it, once .env is filled in' },
    ],
    note: 'Nothing starts until step 3. The bemmoly command comes only with the one-command install.',
    link: { label: 'The Docker Compose guide: every setting in .env', href: '/docs/compose' },
    wide: true,
  },
  {
    id: 'own-postgres',
    icon: 'database',
    title: 'I have my own Postgres',
    status: 'available',
    body: 'One flag, and the bundled database is left out. With Compose, set DATABASE_URL in .env and drop db from COMPOSE_PROFILES.',
    steps: [
      {
        code: `$ curl -fsSL https://get.bemmoly.com | sh -s -- \\
    --database-url postgres://bemmoly:PASSWORD@db.internal:5432/bemmoly_db`,
        label: 'On the VM, with your database’s address',
      },
    ],
    note: 'Postgres 18 with the pgvector extension: the schema changes need both.',
    wide: true,
  },
  {
    id: 'helm',
    icon: 'hexagon',
    title: 'I run Kubernetes',
    status: 'soon',
    body: 'A Helm chart that runs the same image against your own Postgres.',
    note: 'Until it ships, run the one command on a VM, or Compose.',
  },
  {
    id: 'terraform',
    icon: 'globe',
    title: 'I want managed infrastructure',
    status: 'soon',
    body: 'Terraform modules that create the VM and run the installer for you.',
    note: 'Until they ship, create the VM in your provider’s console and run the one command.',
  },
];
