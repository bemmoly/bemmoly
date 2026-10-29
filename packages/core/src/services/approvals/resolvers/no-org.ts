import type { OrgLookup } from '../../../contracts/approvals.ts';

/**
 * Until the person record is installed nobody has a manager or owns a cost centre, so stages
 * with those rules resolve to nobody and fail to start (ADR 0051).
 */
export const noOrgLookup: OrgLookup = {
  managerChain: async () => [],
  costCentreOwner: async () => null,
};
