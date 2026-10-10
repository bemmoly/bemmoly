/**
 * The "I already have…" cards on /self-hosting: every way to run Bemmoly other than the
 * recommended one command, titled by the reader's situation. Commands follow deploy/ (the
 * Compose file and env template, the Helm chart, the air-gap bundle's README).
 */
import type { SiteIconName } from '../lib/icons.ts';
import { REPO_URL } from '../lib/links.ts';
import { RELEASE } from './landing.ts';
import type { StatusKey } from './self-hosting.ts';

/** Where the chooser can point: a card id, or the recommended path. */
export type PathId =
  'recommended' | 'compose' | 'helm' | 'terraform' | 'air-gapped' | 'own-postgres';

export interface PathOption {
  id: Exclude<PathId, 'recommended'>;
  /** A drawn icon from the product's set, never letters in a box. */
  icon: SiteIconName;
  title: string;
  status: StatusKey;
  body: string;
  code?: string;
  /** Only commands that work today get a Copy button. */
  copy?: boolean;
  note?: string;
  link?: { label: string; href: string };
  /** Spans the grid: it applies on every other path. */
  wide?: boolean;
}

const BUNDLE = `bemmoly-airgap-${RELEASE.version}-amd64`;

export const PATHS: readonly PathOption[] = [
  {
    id: 'compose',
    icon: 'box',
    title: 'I already run Docker Compose',
    status: 'available',
    body: 'Use the Compose file and env template the installer writes. Postgres, the HTTPS proxy and the in-app updater are Compose profiles you can leave out.',
    code: `$ git clone --depth 1 ${REPO_URL}
$ cd bemmoly/deploy/compose && cp env.template .env
$ docker compose up -d`,
    copy: true,
    note: 'Fill in .env before the last command: the version, your domain, the profiles to run and the generated secrets.',
    link: {
      label: 'The Compose file and env template',
      href: `${REPO_URL}/tree/main/deploy/compose`,
    },
  },
  {
    id: 'helm',
    icon: 'hexagon',
    title: 'I run Kubernetes',
    status: 'launch',
    body: 'A Helm chart runs the same image as one Deployment, or as separate api and worker Deployments. It connects to your Postgres instead of running one.',
    code: `$ helm install bemmoly ./deploy/helm/bemmoly \\
    --set publicUrl=https://work.example.com`,
    note: 'Bring Postgres 18 with pgvector, and keep DATABASE_URL and the secret key in a Secret named bemmoly. The chart in the repository is a starting point, not a release yet.',
  },
  {
    id: 'terraform',
    icon: 'globe',
    title: 'I want managed infrastructure',
    status: 'launch',
    body: 'Terraform modules for AWS, GCP and Hetzner will create the VM, with a managed Postgres on AWS and GCP, and run the installer through cloud-init.',
    note: 'Until they ship, create the VM in your provider’s console and use the one command above.',
  },
  {
    id: 'air-gapped',
    icon: 'wifi-off',
    title: 'My servers have no internet',
    status: 'offline',
    body: 'Each release has a bundle with the four images, the installer, the Compose file and checksums. Copy it to the machine; Docker must already be installed there.',
    code: `$ tar -xzf ${BUNDLE}.tar.gz
$ cd ${BUNDLE}
$ sudo sh install.sh --version ${RELEASE.version} \\
    --image-archive images.tar --domain bemmoly.internal`,
    copy: true,
    note: 'Later updates: upload the next bundle on the Updates page.',
  },
  {
    id: 'own-postgres',
    icon: 'database',
    title: 'I have my own Postgres',
    status: 'available',
    body: 'One flag on any path, and the bundled database is left out. With Compose, set DATABASE_URL in .env and drop db from COMPOSE_PROFILES; on Kubernetes it goes in the Secret.',
    code: `$ curl -fsSL https://get.bemmoly.com | sh -s -- \\
    --database-url postgres://bemmoly:PASSWORD@db.internal:5432/bemmoly_db`,
    copy: true,
    note: 'Postgres 18 is required; 17 is accepted with a warning. Install the pgvector extension too: the health page says when it is missing.',
    wide: true,
  },
];
