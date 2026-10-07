import { useParams } from '@tanstack/react-router';
import { Suspense } from 'react';
import { useModule } from '../hooks/use-modules.ts';
import { MODULE_CHUNKS, PlaceholderChunk } from '../services/module-chunks.ts';

export function ModulePage() {
  const { moduleId } = useParams({ from: '/$moduleId' });
  const { manifest, isPending } = useModule(moduleId);
  if (isPending) return null;
  if (!manifest) {
    return <p className="p-6 text-tx4">There is no module at /{moduleId}.</p>;
  }
  const Chunk = MODULE_CHUNKS[manifest.id] ?? PlaceholderChunk;
  return (
    <Suspense fallback={null}>
      <Chunk manifest={manifest} />
    </Suspense>
  );
}
