import { attachAccountBodySchema, projectIdSchema } from '@bemmoly/module-pipelines/shared';
import type { AttachAccountBody } from '@bemmoly/module-pipelines/shared';

/** What the attach dialog holds: four text fields, only the project ID required. */
export interface AttachDraft {
  externalId: string;
  name: string;
  deployer: string;
  runtime: string;
}

export const EMPTY_ATTACH: AttachDraft = { externalId: '', name: '', deployer: '', runtime: '' };

export type AttachField = 'externalId' | 'deployer' | 'runtime';

/** The fields that hold something the server would refuse; empty optional fields are fine. */
export function attachProblems(draft: AttachDraft): Set<AttachField> {
  const problems = new Set<AttachField>();
  if (draft.externalId.trim() && !projectIdSchema.safeParse(draft.externalId).success) {
    problems.add('externalId');
  }
  const account = attachAccountBodySchema.shape.deployerServiceAccount;
  if (draft.deployer.trim() && !account.safeParse(draft.deployer.trim()).success) {
    problems.add('deployer');
  }
  if (draft.runtime.trim() && !account.safeParse(draft.runtime.trim()).success) {
    problems.add('runtime');
  }
  return problems;
}

export function attachReady(draft: AttachDraft): boolean {
  return draft.externalId.trim().length > 0 && attachProblems(draft).size === 0;
}

/** Empty optional fields are left out, so the server takes the project's own name. */
export function attachBodyOf(draft: AttachDraft): AttachAccountBody {
  const name = draft.name.trim();
  return {
    externalId: draft.externalId.trim(),
    ...(name ? { name } : {}),
    deployerServiceAccount: draft.deployer.trim() || null,
    runtimeServiceAccount: draft.runtime.trim() || null,
  };
}
