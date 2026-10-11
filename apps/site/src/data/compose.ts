/**
 * Docker Compose by hand, in the order that works: the files go to /var/bemmoly with the
 * folders the installer makes (deploy/installer/lib/config.sh), .env is filled in, and only
 * then does anything start. One block per step, each with its own Copy button, so no
 * pasted block starts the stack before .env is ready. Shared by the homepage, /self-hosting
 * and /docs/compose, so the three never disagree.
 */
import { LATEST } from '../lib/changelog.ts';
import { REPO_URL } from '../lib/links.ts';

export const COMPOSE_FILES = `$ git clone --depth 1 --branch v${LATEST.version} ${REPO_URL}
$ sudo install -d -m 755 /var/bemmoly
$ sudo cp bemmoly/deploy/compose/docker-compose.yml bemmoly/deploy/compose/Caddyfile /var/bemmoly/
$ sudo install -m 600 bemmoly/deploy/compose/env.template /var/bemmoly/.env
$ cd /var/bemmoly
$ sudo install -d -m 750 -o 10001 -g 10001 data backups
$ sudo install -d -m 755 pg
$ sudo install -d -m 700 caddy caddy/data caddy/config`;

/** Opens the settings file; every @…@ placeholder in it needs a value before step 3. */
export const COMPOSE_EDIT = '$ sudoedit /var/bemmoly/.env';

export const COMPOSE_START = `$ cd /var/bemmoly
$ sudo docker compose up -d
$ sudo docker compose ps`;

export const COMPOSE_UPDATE = `$ cd /var/bemmoly
$ sudo docker compose pull
$ sudo docker compose up -d`;
