import { moduleColorSchema, sidebarSectionSchema } from '@bemmoly/shared';
import type { BemmolyModule } from './contract.ts';
import type { ModuleContributions } from './contributions.ts';
import { ModuleLoadError } from './errors.ts';

const under = (moduleId: string, path: string) =>
  path === `/${moduleId}` || path.startsWith(`/${moduleId}/`) || path.startsWith(`/${moduleId}?`);

/**
 * How a module asks to be drawn in the shell: its tile and its sidebar section. Checked once
 * at boot, after register(), so a section's "+" can only name a create entry the module added
 * and every link stays inside the module's own area.
 */
export function checkModuleLook(module: BemmolyModule, contributions: ModuleContributions): void {
  const fail = (message: string): never => {
    throw new ModuleLoadError(`Module "${module.id}": ${message}`, module.id);
  };
  if (module.icon !== undefined && module.icon.trim() === '') fail('icon must name an icon');
  if (module.color !== undefined && !moduleColorSchema.safeParse(module.color).success) {
    fail(`color "${module.color}" is not a module colour`);
  }
  if (module.order !== undefined && !Number.isInteger(module.order))
    fail('order is not a whole number');
  if (!module.sidebar) return;
  const parsed = sidebarSectionSchema.safeParse(module.sidebar);
  if (!parsed.success) return fail('sidebar section is not valid');
  const section = parsed.data;
  for (const path of [
    section.path,
    ...[...section.links, ...section.primary].map((link) => link.path),
  ]) {
    if (!under(module.id, path)) fail(`sidebar path "${path}" must live under "/${module.id}"`);
  }
  const create = section.add?.create;
  if (
    create &&
    !contributions.navigation.some((entry) => entry.placement === 'create' && entry.id === create)
  ) {
    fail(`sidebar add names "${create}", which is not one of its create entries`);
  }
}
