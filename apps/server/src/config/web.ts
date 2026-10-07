import { fileURLToPath } from 'node:url';

/** apps/web/dist, next to this app in the workspace and in the image. */
export const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../../../web/dist', import.meta.url));
