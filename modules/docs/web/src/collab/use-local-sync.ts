import { useEffect, useRef } from 'react';
import type { Doc } from 'yjs';
import type { PageDetail } from '../../../shared/pages.ts';
import { api } from '../shared/api.ts';
import { FROM_SEED, FROM_STORE } from './origins.ts';

const WRITE_AFTER_MS = 600;

/**
 * Local mode (the dev mock, no collab server) keeps the tab's document and the stored page in
 * step both ways, as the collab server does for a live page: typing is written to the page a
 * moment after it stops, and a body changed elsewhere (a restore, an applied fix) replaces
 * the tab's. Only a body newer than any seen replaces it, so a reply that left before the
 * tab's own write landed never undoes typing.
 */
export function useLocalSync(page: PageDetail, doc: Doc | null, local: boolean): void {
  /** The newest body edit time seen, from the page or from the tab's own writes. */
  const seenAt = useRef(page.contentUpdatedAt);
  const pageId = page.id;

  useEffect(() => {
    if (!local || !doc) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const write = async () => {
      const { localSnapshot } = await import('./extensions.ts');
      if (!alive) return;
      const saved = await api.docs.pages.update(pageId, { snapshot: localSnapshot(doc) });
      if (saved.contentUpdatedAt > seenAt.current) seenAt.current = saved.contentUpdatedAt;
    };
    const onUpdate = (_update: Uint8Array, origin: unknown) => {
      if (origin === FROM_STORE || origin === FROM_SEED) return;
      clearTimeout(timer);
      timer = setTimeout(() => void write().catch(() => undefined), WRITE_AFTER_MS);
    };
    doc.on('update', onUpdate);
    return () => {
      alive = false;
      clearTimeout(timer);
      doc.off('update', onUpdate);
    };
  }, [local, doc, pageId]);

  const { snapshot, contentUpdatedAt } = page;
  useEffect(() => {
    if (!local || !doc || !snapshot || contentUpdatedAt <= seenAt.current) return undefined;
    seenAt.current = contentUpdatedAt;
    let alive = true;
    void import('./extensions.ts').then(({ replaceLocal }) => {
      if (alive) replaceLocal(doc, snapshot, FROM_STORE);
    });
    return () => {
      alive = false;
    };
  }, [local, doc, snapshot, contentUpdatedAt]);
}
