import type { SqlExecutor } from '../../../contracts/sql.ts';
import type { ApproverResolver, OrgLookup } from '../../../contracts/approvals.ts';

/**
 * Users by id and role from the kernel's people tables; manager and cost-centre questions go
 * to the org lookup.
 */
export function createDirectoryResolver(sql: SqlExecutor, org: OrgLookup): ApproverResolver {
  return {
    async resolve(rule, context, transaction) {
      const executor = transaction ?? sql;
      switch (rule.type) {
        case 'user':
          return [rule.userId];
        case 'role': {
          const rows = await executor<{ id: string }[]>`
            select u.id from users u join roles r on r.id = u.role_id
            where r.key = ${rule.roleKey} order by u.id`;
          return rows.map((row) => row.id);
        }
        case 'manager': {
          const chain = await org.managerChain(context.requesterId, rule.levels, executor);
          const manager = chain[rule.levels - 1];
          return manager ? [manager] : [];
        }
        case 'cost_centre_owner': {
          const owner = await org.costCentreOwner(context, executor);
          return owner ? [owner] : [];
        }
      }
    },
  };
}
