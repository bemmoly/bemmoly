import { applyAuthParams } from '../mocks/auth-preset.ts';
import { createMockDb, MOCK_SCENARIOS, type MockDb, type MockScenario } from '../mocks/db.ts';
import { atRelease } from './release.ts';

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
 * the customer brand block ("on Bemmoly" under it). `?mock=signed-out` opens the sign-in pages,
 * and `?sso=1|3|required` gives them single sign-on (mocks/auth-preset.ts). With a `version`, the install reports that
 * release everywhere.
 */
export function demoWorkspace(options: { search?: string; version?: string } = {}): MockDb {
  const { search = '', version } = options;
  const params = new URLSearchParams(search);
  const asked = params.get('mock') as MockScenario | null;
  // `?mock=signed-out` opens the sign-in pages; the demo never runs the first-run wizard.
  const scenario = asked && MOCK_SCENARIOS.includes(asked) && asked !== 'fresh' ? asked : 'ready';
  const db = createMockDb(scenario);
  if (version) atRelease(db, version);
  const example = (id: string) => id === 'sample';
  db.manifests = db.manifests.filter((manifest) => !example(manifest.id));
  db.grants = db.grants.filter((grant) => !example(grant.moduleId));
  db.adminModules = db.adminModules.filter((module) => !example(module.id));
  applyAuthParams(db, params);
  return db;
}
