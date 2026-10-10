import type { ModuleChunkProps } from '@bemmoly/core-web';

/** Stands in for a module's web chunk until the module ships one. */
export default function ModulePlaceholder({ manifest }: ModuleChunkProps) {
  const label = manifest.navigation[0]?.label ?? manifest.id;
  return (
    <section className="px-10 py-8" data-module={manifest.id}>
      <h1 className="m-0 text-20 font-semibold tracking-title text-tx">{label}</h1>
      <p className="mt-1 text-tx-3">
        Module {manifest.id} {manifest.version} is enabled. It has no screens yet.
      </p>
    </section>
  );
}
