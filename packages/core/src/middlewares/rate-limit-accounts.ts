import { createHash } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

type AccountOf = (request: FastifyRequest) => string | undefined;

const stringField = (source: unknown, name: string): string | undefined => {
  if (typeof source !== 'object' || source === null) return undefined;
  const value = (source as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

/** Normalised as the email schema does, so case and spaces do not reset a budget. */
const emailIn: AccountOf = (request) =>
  stringField(request.body, 'email')?.trim().toLowerCase() || undefined;
const bodyLink: AccountOf = (request) => stringField(request.body, 'token');
const pathLink: AccountOf = (request) => stringField(request.params, 'token');

/**
 * Anonymous routes that name one account, by method and path under the API prefix,
 * and where in the request the account is named: an email address, or the link token
 * that stands for one. Spreading attempts over many addresses cannot pass this budget.
 */
const ACCOUNT_ROUTES: Readonly<Record<string, AccountOf>> = {
  'POST /auth/login': emailIn,
  'POST /auth/password-reset': emailIn,
  'POST /auth/password-reset/complete': bodyLink,
  'POST /auth/invitations/:token/accept': pathLink,
};

export function accountOfRoute(method: string, path: string): AccountOf | undefined {
  return ACCOUNT_ROUTES[`${method} ${path}`];
}

/** Bucket keys hold a digest, so the table never stores an address or a live link token. */
export function accountBucketKey(route: string, account: string): string {
  const digest = createHash('sha256').update(account, 'utf8').digest('base64url');
  return `account|${route}|${digest}`;
}
