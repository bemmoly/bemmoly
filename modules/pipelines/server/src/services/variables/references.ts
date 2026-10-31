import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { appReferencesOf } from '../../../../shared/app-references.ts';
import type { EnvironmentRef } from '../../../../shared/environments.ts';
import type { Variable } from '../../../../shared/variables.ts';
import type { DeployVariable } from '../providers/contract.ts';
import {
  addressesFor,
  fillReferences,
  referencedApplications,
} from '../deploy-settings/addresses.ts';

/*
 * Plain values that name other applications' addresses (shared/app-references.ts): checked
 * when set, shown filled in per environment, and filled in for real at deploy time. A deploy
 * whose value names an application not yet deployed in that environment stops with one
 * sentence naming it, so callees go out first.
 */

/** Refuses a value naming an application that does not exist. */
export async function checkReferences(sql: SqlExecutor, value: string): Promise<void> {
  const named = referencedApplications([value]);
  if (named.length === 0) return;
  const found = await sql<{ key: string }[]>`
    select key from pipeline_applications
    where key = any(${named}::text[]) and archived_at is null`;
  const missing = named.filter((key) => !found.some((row) => row.key === key));
  if (missing[0]) {
    throw new ValidationError(
      `No application is called ${missing[0]}. Name one from the catalog, such as \${{ apps.<key>.url }}`,
    );
  }
}

/** Each plain value with references, filled in for every environment it reaches. */
export async function withResolved(
  sql: SqlExecutor,
  items: Variable[],
  environments: readonly EnvironmentRef[],
): Promise<Variable[]> {
  const values = items.flatMap((item) => (item.kind === 'plain' && item.value ? [item.value] : []));
  const named = referencedApplications(values);
  if (named.length === 0) return items;
  const addresses = await addressesFor(
    sql,
    named,
    environments.map((environment) => environment.id),
  );
  return items.map((item) => {
    if (item.kind !== 'plain' || !item.value || appReferencesOf(item.value).length === 0) {
      return item;
    }
    const value = item.value;
    const reached = item.environment ? [item.environment] : environments;
    return {
      ...item,
      resolved: reached.map((environment) => ({
        environment: environment.key,
        ...fillReferences(value, environment.key, addresses),
      })),
    };
  });
}

/** The variables with every reference filled in for one environment, or the deploy stops. */
export async function fillForDeploy(
  sql: SqlExecutor,
  environment: { id: string; key: string },
  application: string,
  variables: DeployVariable[],
): Promise<DeployVariable[]> {
  const values = variables.flatMap((v) => (v.kind === 'plain' ? [v.value] : []));
  const named = referencedApplications(values);
  if (named.length === 0) return variables;
  const addresses = await addressesFor(sql, named, [environment.id]);
  return variables.map((variable) => {
    if (variable.kind !== 'plain') return variable;
    const filled = fillReferences(variable.value, environment.key, addresses);
    if (filled.problem || filled.value === null) {
      throw new ValidationError(
        `${application}'s ${variable.name} needs an address: ${filled.problem ?? 'none is known'}`,
      );
    }
    return { ...variable, value: filled.value };
  });
}
