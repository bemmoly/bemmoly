/** Commands and files shown on /self-hosting, from tech design §18. */
import { RELEASE } from './landing.ts';
import { INSTALL_COMMAND } from '../lib/links.ts';

const IMAGE = `ghcr.io/bemmoly/bemmoly:${RELEASE.version}`;

export const INSTALL_BLOCK = `$ ${INSTALL_COMMAND}`;

export const INSTALL_FLAGS = `$ curl -fsSL https://get.bemmoly.com | sh -s -- --domain work.example.com
$ curl -fsSL https://get.bemmoly.com | sh -s -- --modules work,docs --no-in-app-updates`;

export const SIZING = [
  { team: 'Up to 50 people', vm: '1 vCPU, 2 GB', note: 'Comfortable; AI jobs run one at a time.' },
  { team: 'Up to 200 people', vm: '2 vCPU, 4 GB', note: 'The target size for one VM.' },
  {
    team: 'Up to 1,000 people',
    vm: '4 vCPU, 8 GB',
    note: 'Or split the api and worker roles; Postgres on its own machine.',
  },
  { team: 'Beyond', vm: 'Helm', note: 'Several replicas and a managed Postgres.' },
];

export const COMPOSE = `services:
  bemmoly:
    image: ${IMAGE}
    env_file: .env
    volumes: [./data:/var/bemmoly/data]
    depends_on: { db: { condition: service_healthy } }
  db:
    image: pgvector/pgvector:pg18
    volumes: [./pg:/var/lib/postgresql/data]
  proxy:      # optional: HTTPS with automatic certificates
    image: caddy:2
    ports: ["80:80", "443:443"]
  updater:    # optional: powers the in-app Update button
    image: ghcr.io/bemmoly/updater:1`;

export const DEMO = '$ docker run -p 8080:8080 ghcr.io/bemmoly/bemmoly:latest --demo';

export const UPGRADE = `$ bemmoly upgrade            # latest version on your channel
$ bemmoly upgrade ${RELEASE.version}      # a specific version
$ bemmoly rollback           # back to the version you came from`;

export const BACKUP = `$ bemmoly backup
$ bemmoly backups list
$ bemmoly restore /var/bemmoly/backups/<file>`;

export const CLI = [
  [
    'bemmoly status',
    'Containers, version, database size, queue depth, last backup, certificate expiry.',
  ],
  ['bemmoly doctor', 'Re-runs the installer checks and the app health checks, and prints fixes.'],
  ['bemmoly logs', 'Follows the app logs without learning the Compose layout.'],
  ['bemmoly config set KEY VALUE', 'Changes a setting in .env and restarts what needs it.'],
] as const;
