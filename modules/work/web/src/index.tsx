import type { ModuleChunkProps } from '@bemmoly/core-web';

/** The Work chunk: the Board and Backlog screens replace this as they land. */
export default function WorkModule({ manifest }: ModuleChunkProps) {
  return (
    <section className="px-10 py-8" data-module={manifest.id}>
      <h1 className="m-0 text-22 font-semibold tracking-title text-tx">Work</h1>
      <p className="mt-1 text-tx4">
        Module {manifest.id} {manifest.version} is enabled. Its screens are on the way.
      </p>
    </section>
  );
}
