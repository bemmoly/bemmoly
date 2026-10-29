import type { OrgLookup } from '../../contracts/approvals.ts';
import type { PersonDirectory } from '../../contracts/people.ts';

/**
 * The approval engine's manager and cost-centre questions, answered from the person record
 * (ADR 0050, ADR 0051). `fields.costCentre` names a cost centre by id; without one the
 * requester's own cost centre decides.
 */
export function createPersonOrgLookup(directory: PersonDirectory): OrgLookup {
  return {
    async managerChain(userId, levels, transaction) {
      const chain = await directory.managerChain(userId, transaction);
      return chain.slice(0, levels).map((person) => person.userId);
    },
    async costCentreOwner(context, transaction) {
      const named = context.fields['costCentre'];
      const id =
        typeof named === 'string'
          ? named
          : (await directory.get(context.requesterId, transaction))?.costCentreId;
      if (!id) return null;
      return (await directory.costCentre(id, transaction))?.ownerUserId ?? null;
    },
  };
}
