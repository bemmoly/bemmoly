import {
  ErrorBoundary,
  knownIcon,
  moduleName,
  ModuleTile,
  openCreate,
  SidebarHeading,
  SidebarRow,
  useFrame,
  useLoaded,
} from '@bemmoly/core-web';
import type { ModuleManifest } from '@bemmoly/shared';
import { Skeleton } from '@bemmoly/ui';
import { MODULE_CREATES, MODULE_SIDEBARS } from '../../lib/module-shell.ts';

/** Two rows the height of the live ones, so the section does not jump when they land. */
function RowsLoading() {
  const { mode } = useFrame();
  if (mode === 'rail') return <Skeleton width={22} height={22} className="my-1.5 rounded-chip" />;
  return (
    <div aria-hidden className="flex flex-col">
      {[96, 120].map((width) => (
        <div key={width} className="flex h-7.5 items-center gap-2 px-2">
          <Skeleton width={18} height={18} className="rounded-chip" />
          <Skeleton width={width} height={10} />
        </div>
      ))}
    </div>
  );
}

/** The module's live rows from its own sidebar entry, loaded beside the shell. */
function LiveRows({ manifest }: { manifest: ModuleManifest }) {
  const entry = MODULE_SIDEBARS.resolve(manifest.id);
  const ready = useLoaded(entry);
  if (!entry) return null;
  if (!ready) return <RowsLoading />;
  return (
    <ErrorBoundary resetKey={manifest.version} fallback={() => null}>
      <entry.Component manifest={manifest} />
    </ErrorBoundary>
  );
}

/**
 * One module's sidebar section: its tile and name with the "+" its manifest names, the rows
 * its sidebar entry draws, then its fixed links. A module from an older server, with no
 * section declared, and one with nothing to list, get a single row to its area.
 */
export function ModuleSection({ manifest }: { manifest: ModuleManifest }) {
  const name = moduleName(manifest);
  const rail = useFrame().mode === 'rail';
  const section = manifest.sidebar;
  const bare = !MODULE_SIDEBARS.resolve(manifest.id) && (section?.links.length ?? 0) === 0;
  if (!section || bare) {
    const top = manifest.navigation.find((entry) => entry.placement === 'top');
    return (
      <SidebarRow
        label={top?.label ?? name}
        icon={<ModuleTile manifest={manifest} size={16} />}
        path={section?.path ?? top?.path ?? `/${manifest.id}`}
      />
    );
  }
  const add = section.add;
  return (
    <section aria-label={name} className={`flex flex-col gap-0.5 ${rail ? 'items-center' : ''}`}>
      <SidebarHeading
        label={name}
        tile={<ModuleTile manifest={manifest} size={14} />}
        add={
          add && MODULE_CREATES.has(add.create)
            ? { label: add.label, onSelect: () => openCreate(add.create) }
            : undefined
        }
      />
      <LiveRows manifest={manifest} />
      {section.links.map((link) => (
        <SidebarRow
          key={link.id}
          label={link.label}
          icon={knownIcon(link.icon) ?? 'chevron'}
          path={link.path}
          exact
        />
      ))}
    </section>
  );
}
