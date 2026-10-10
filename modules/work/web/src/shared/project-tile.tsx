import type { Project } from '@bemmoly/module-work/shared';
import { EntityTile } from '@bemmoly/ui';

/**
 * A project's tile: its initial on a hue taken from its name, the same in the sidebar, the
 * breadcrumb's switcher, the rail and the projects list (docs/design/premium/kit.js, `pt`).
 */
export function ProjectTile({
  project,
  size = 18,
}: {
  project: Pick<Project, 'name' | 'key'>;
  size?: number;
}) {
  return <EntityTile name={project.name || project.key} size={size} />;
}
