/*
 * Docker image references, following the distribution reference grammar, so a name from a
 * pipeline or a release is checked before it reaches the Docker Engine API's paths and
 * queries, where a "?", "#" or "../" would change which call is made.
 */

const COMPONENT = '[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*';
const DOMAIN_PART = '(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])';
const DOMAIN = `${DOMAIN_PART}(?:\\.${DOMAIN_PART})*(?::[0-9]+)?`;
const NAME = `(?:${DOMAIN}/)?${COMPONENT}(?:/${COMPONENT})*`;
const TAG = '\\w[\\w.-]{0,127}';
const DIGEST = '[A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*:[0-9a-fA-F]{32,}';

const REFERENCE = new RegExp(`^${NAME}(?::${TAG})?(?:@${DIGEST})?$`);
const REPOSITORY = new RegExp(`^${NAME}$`);
const MAX_LENGTH = 255;

/** "alpine:3.20", "ghcr.io/acme/api@sha256:…", "localhost:5000/team/app:1.2". */
export function isImageReference(value: string): boolean {
  return value.length <= MAX_LENGTH && REFERENCE.test(value);
}

/** A repository with no tag or digest, such as "europe-docker.pkg.dev/acme/apps/api". */
export function isImageRepository(value: string): boolean {
  return value.length <= MAX_LENGTH && REPOSITORY.test(value);
}
