import { describe, expect, it } from 'vitest';
import { isImageReference, isImageRepository } from './image-reference.ts';

const DIGEST = `sha256:${'a'.repeat(64)}`;

describe('image references', () => {
  it.each([
    'alpine',
    'alpine:3.20',
    'node:22.17.1-alpine',
    'library/alpine:latest',
    'ghcr.io/acme/checkout-api:1.4.0',
    `ghcr.io/acme/checkout-api@${DIGEST}`,
    `localhost:5000/team/app:1.2@${DIGEST}`,
    'europe-docker.pkg.dev/acme-prod/apps/checkout_api',
  ])('accepts %s', (value) => {
    expect(isImageReference(value)).toBe(true);
  });

  it.each([
    '',
    'alpine?x=1',
    'alpine#frag',
    '../containers/abc',
    'alpine/../../containers/abc/json',
    'alpine:3.20 && rm -rf /',
    'Alpine',
    '-alpine',
    'alpine:',
    'alpine@sha256:short',
    `a${'b'.repeat(300)}`,
  ])('refuses %s', (value) => {
    expect(isImageReference(value)).toBe(false);
  });

  it('knows a repository from a reference with a tag', () => {
    expect(isImageRepository('ghcr.io/acme/checkout-api')).toBe(true);
    expect(isImageRepository('ghcr.io/acme/checkout-api:1.0')).toBe(false);
    expect(isImageRepository(`ghcr.io/acme/checkout-api@${DIGEST}`)).toBe(false);
  });
});
