import { PageLayout } from '@bemmoly/core-web';
import { Loading } from './form.tsx';

/**
 * A route whose code is still on its way: the frame's page with a skeleton, so the content
 * area never keeps the page the person just left while the sidebar already names the next.
 */
export function PagePending() {
  return (
    <PageLayout layout="contained" header={{ crumbs: [] }} title={['Loading']}>
      <Loading lines={4} />
    </PageLayout>
  );
}

/** The same inside a frame that already draws the page (Settings), so only the body waits. */
export function PageBodyPending() {
  return <Loading lines={4} />;
}
