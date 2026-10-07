import type { MockRoute } from '../types.ts';
import { operationsRoutes } from './operations.ts';
import { peopleRoutes } from './people.ts';
import { sessionRoutes } from './session.ts';
import { settingsRoutes } from './settings.ts';

export const ROUTES: readonly MockRoute[] = [
  ...sessionRoutes,
  ...peopleRoutes,
  ...settingsRoutes,
  ...operationsRoutes,
];
