import type { ExportFacts, ExportRecords } from '../../export-contract.ts';
import { attr, block, comment, interpolate, nameOf, type Expr, type Item } from './hcl.ts';

/*
 * What every Terraform file of one connection shares: names that never collide, how a project
 * is referred to (the resource when Pipelines made it, the variable when it was attached), the
 * import block that adopts each resource, and the values a person must fill in.
 */

export type TerraformFile =
  | 'landing-zone.tf'
  | 'identities.tf'
  | 'registry.tf'
  | 'secrets.tf'
  | 'cloud-run.tf'
  | 'clusters.tf';

export function createTerraform(records: ExportRecords, facts: ExportFacts) {
  const taken = new Set<string>();
  const files = new Map<TerraformFile, Item[][]>();
  const imports: Item[][] = [];
  const projects = new Set<string>();
  const numbers = new Set<string>();
  /** Domain folders by Terraform name, with their ID when the cloud said what it is. */
  const folders = new Map<string, string | null>();
  /** What a person fills in or decides before a plan, one sentence each. */
  const fill: string[] = [];
  /** Service accounts this export declares, "name@account" to their Terraform name. */
  const identities = new Map<string, string>();
  /** Secrets this export declares, "account/name" to their Terraform name. */
  const secrets = new Map<string, string>();
  /** Grants already exported, so services sharing a reader grant it once. */
  const granted = new Set<string>();
  const madeProjects = new Set(
    records.resources
      .filter((resource) => resource.kind === 'account' && resource.spec['adopt'] !== true)
      .map((resource) => resource.account),
  );

  /** A name for a resource of `type`, made unique within the connection. */
  function unique(type: string, base: string): string {
    const name = nameOf(base);
    let candidate = name;
    for (let n = 2; taken.has(`${type}.${candidate}`); n += 1) candidate = `${name}_${n}`;
    taken.add(`${type}.${candidate}`);
    return candidate;
  }

  /** `var.projects.<key>`, the project ID as a variable, for use inside import IDs. */
  function projectVar(account: string): string {
    projects.add(account);
    return `var.projects.${nameOf(account)}`;
  }

  /** The project's number, which Google names service agents and pools by. */
  function numberVar(account: string): string {
    numbers.add(account);
    return `var.project_numbers.${nameOf(account)}`;
  }

  return {
    records,
    facts,
    projects,
    numbers,
    folders,
    fill,
    identities,
    secrets,
    granted,
    unique,
    projectVar,
    numberVar,
    madeProject: (account: string) => madeProjects.has(account),
    /** A project as an attribute: through its resource when this export declares it. */
    projectRef(account: string): Expr {
      if (madeProjects.has(account)) {
        projectVar(account);
        return `google_project.${nameOf(account)}.project_id`;
      }
      return projectVar(account);
    },
    /** "projects/${var.projects.x}/…" and the like: text with the project in it. */
    inProject(account: string, before: string, after = ''): Expr {
      return interpolate([before, { ref: projectVar(account) }, after]);
    },
    add(
      file: TerraformFile,
      resource: { type: string; name: string; body: Item[]; importId?: Expr; note?: string },
    ) {
      const { type, name, body, importId, note } = resource;
      const group = files.get(file) ?? [];
      group.push([...(note ? [comment(note)] : []), block('resource', [type, name], body)]);
      files.set(file, group);
      if (importId) {
        imports.push([block('import', [], [attr('to', `${type}.${name}`), attr('id', importId)])]);
      }
    },
    files,
    imports,
  };
}

export type Terraform = ReturnType<typeof createTerraform>;
