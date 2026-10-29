import {
  slugSchema,
  type CreateEnvironmentBody,
  type Environment,
  type EnvironmentClass,
  type UpdateEnvironmentBody,
} from '@bemmoly/module-pipelines/shared';
import type { ConnectionAccounts } from '../../../hooks/use-clouds.ts';
import { slugOf } from '../../../lib/slug.ts';

/*
 * The New environment and Edit dialogs' rules, apart from their drawing. A field left as
 * null follows its default: the key follows the name, the region follows the chosen
 * project's connection, and protection follows the class (Prod is protected and asks for
 * an approval). Touching a field fixes it.
 */

export interface Protection {
  protected: boolean;
  requiresApproval: boolean;
}

export interface EnvironmentDraft {
  name: string;
  key: string | null;
  class: EnvironmentClass;
  accountId: string | null;
  region: string | null;
  protection: Protection | null;
}

export const NEW_DRAFT: EnvironmentDraft = {
  name: '',
  key: null,
  class: 'dev',
  accountId: null,
  region: null,
  protection: null,
};

const REGION = /^[a-z0-9-]{2,40}$/;

export function defaultProtection(environmentClass: EnvironmentClass): Protection {
  const prod = environmentClass === 'prod';
  return { protected: prod, requiresApproval: prod };
}

export const keyOf = (draft: EnvironmentDraft) => draft.key ?? slugOf(draft.name);

export const protectionOf = (draft: EnvironmentDraft) =>
  draft.protection ?? defaultProtection(draft.class);

/** What the region field shows: what was typed, else the project's connection's region. */
export const regionOf = (draft: EnvironmentDraft, fallback: string | null) =>
  draft.region ?? fallback ?? '';

export const keyValid = (draft: EnvironmentDraft) => slugSchema.safeParse(keyOf(draft)).success;

export const regionValid = (region: string) => !region.trim() || REGION.test(region.trim());

export function draftReady(draft: EnvironmentDraft, fallback: string | null): boolean {
  return draft.name.trim().length > 0 && keyValid(draft) && regionValid(regionOf(draft, fallback));
}

export function createBodyOf(
  draft: EnvironmentDraft,
  fallback: string | null,
): CreateEnvironmentBody {
  return {
    key: keyOf(draft),
    name: draft.name.trim(),
    class: draft.class,
    provider: 'gcp',
    cloudAccountId: draft.accountId,
    region: regionOf(draft, fallback).trim() || null,
    protection: protectionOf(draft),
  };
}

/** An environment as the Edit dialog starts: everything fixed to what it is now. */
export function draftOf(environment: Environment): EnvironmentDraft {
  return {
    name: environment.name,
    key: environment.key,
    class: environment.class,
    accountId: environment.cloudAccount?.id ?? null,
    region: environment.region,
    protection: {
      protected: environment.protection.protected,
      requiresApproval: environment.protection.requiresApproval,
    },
  };
}

/** Only what changed, since an edit changes exactly what it names. */
export function changesOf(
  environment: Environment,
  draft: EnvironmentDraft,
): UpdateEnvironmentBody {
  const changes: UpdateEnvironmentBody = {};
  const name = draft.name.trim();
  if (name !== environment.name) changes.name = name;
  if (draft.class !== environment.class) changes.class = draft.class;
  if (draft.accountId !== (environment.cloudAccount?.id ?? null)) {
    changes.cloudAccountId = draft.accountId;
  }
  const region = draft.region === null ? null : draft.region.trim() || null;
  if (region !== environment.region) changes.region = region;
  const protection = protectionOf(draft);
  const was = environment.protection;
  if (
    protection.protected !== was.protected ||
    protection.requiresApproval !== was.requiresApproval
  ) {
    changes.protection = protection;
  }
  return changes;
}

export interface AccountChoice {
  id: string;
  externalId: string;
  name: string;
  region: string | null;
}

export interface AccountGroup {
  connection: string;
  accounts: AccountChoice[];
}

/**
 * Projects an environment may deploy into: ready ones only, created or attached, grouped by
 * the connection they came from, each carrying that connection's region as its default.
 * Connections with none ready are left out.
 */
export function groupReadyAccounts(items: readonly ConnectionAccounts[]): AccountGroup[] {
  return items
    .map(({ connection, accounts }) => ({
      connection: connection.name,
      accounts: accounts
        .filter((account) => account.status === 'ready' && account.purpose === 'workload')
        .map((account) => ({
          id: account.id,
          externalId: account.externalId,
          name: account.name,
          region: connection.region,
        })),
    }))
    .filter((group) => group.accounts.length > 0);
}

export function accountById(groups: readonly AccountGroup[], id: string | null) {
  if (!id) return null;
  for (const group of groups) {
    const found = group.accounts.find((account) => account.id === id);
    if (found) return found;
  }
  return null;
}
