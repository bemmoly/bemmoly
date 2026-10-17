import { fileURLToPath } from 'node:url';

/** apps/web/dist, next to this app in the workspace and in the image. */
export const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../../web/dist', import.meta.url));

/**
 * Products with their own web app on this origin (ADR 0037): Pipelines' build, served under
 * /pipelines whenever it was built into the image.
 */
export const DEFAULT_PRODUCT_WEBS = [
  {
    base: '/pipelines',
    root: fileURLToPath(new URL('../../../pipelines-web/dist', import.meta.url)),
  },
] as const;
