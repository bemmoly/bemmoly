import { isThemeId, RETIRED_PRESETS } from '@bemmoly/ui/tokens';
import { createMockDb, type MockDb } from '../mocks/db.ts';
import { seedAcmeLogo } from '../mocks/seed/logo.ts';
import { atRelease } from './release.ts';

const MODES = ['light', 'dark', 'system'] as const;

/**
 * The demo's workspace: the mock backend's signed-in "ready" install (Acme Labs, its people,
 * teams and Work projects), so the demo is exactly what the screens are built and tested
 * against. Every module the mocks ship is on, so a new module's screens and mock handlers
 * appear in the demo once they land, with no change here. The one exception is Sample, the
 * developer example: an install leaves it off, so a visitor never sees it, not even in
 * Settings › Modules.
 *
 * `?theme=pine&mode=dark` starts the workspace in that theme and mode, so the site's previews
 * can match the page around them. A retired preset id (`?theme=ocean`) still works: it maps to
 * its theme in its old mode. `?logo=acme` starts with Acme Labs' own logo, so a preview can show
 * the customer brand block ("on Bemmoly" under it). With a `version`, the install reports that
 * release everywhere.
 */
export function demoWorkspace(options: { search?: string; version?: string } = {}): MockDb {
  const { search = '', version } = options;
  const db = createMockDb('ready');
  if (version) atRelease(db, version);
  const example = (id: string) => id === 'sample';
  db.manifests = db.manifests.filter((manifest) => !example(manifest.id));
  db.grants = db.grants.filter((grant) => !example(grant.moduleId));
  db.adminModules = db.adminModules.filter((module) => !example(module.id));
  const params = new URLSearchParams(search);
  const asked = params.get('theme') ?? '';
  const retired = RETIRED_PRESETS[asked];
  const theme = isThemeId(asked) ? asked : retired?.theme;
  if (theme) db.settings['appearance.theme'] = theme;
  if (retired) db.settings['appearance.font'] = retired.font;
  const mode = MODES.find((entry) => entry === params.get('mode')) ?? retired?.mode;
  if (mode) db.settings['appearance.defaultMode'] = mode;
  if (params.get('logo') === 'acme') seedAcmeLogo(db);
  return db;
}
