import type { DesiredResource } from '../providers/contract.ts';

/* Dependency order for applying a landing zone: what a resource needs is applied first. */

/** "deployer_identity/deployer@acme-commerce-prod-3f2a": how dependencies name a resource. */
export const keyOf = (resource: Pick<DesiredResource, 'kind' | 'name' | 'account'>) =>
  `${resource.kind}/${resource.name}@${resource.account}`;

/**
 * Resources ordered so each comes after everything it depends on, keeping the declared order
 * otherwise. A dependency on a resource outside the set is ignored; a cycle is a bug in the
 * declaration and throws.
 */
export function inDependencyOrder(resources: readonly DesiredResource[]): DesiredResource[] {
  const byKey = new Map(resources.map((resource) => [keyOf(resource), resource]));
  const ordered: DesiredResource[] = [];
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (resource: DesiredResource) => {
    const key = keyOf(resource);
    if (state.get(key) === 'done') return;
    if (state.get(key) === 'visiting') throw new Error(`The landing zone has a cycle at ${key}`);
    state.set(key, 'visiting');
    for (const dependency of resource.dependsOn) {
      const found = byKey.get(dependency);
      if (found) visit(found);
    }
    state.set(key, 'done');
    ordered.push(resource);
  };
  for (const resource of resources) visit(resource);
  return ordered;
}
