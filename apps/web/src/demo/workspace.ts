import { PRESETS } from '@bemmoly/ui/tokens';
import { createMockDb, type MockDb } from '../mocks/db.ts';

/**
 * The demo's workspace: the mock backend's signed-in "ready" install (Acme Labs, its people,
 * teams and Work projects), so the demo is exactly what the screens are built and tested
 * against. Every module the mocks ship is on, so a new module's screens and mock handlers
 * appear in the demo once they land, with no change here. The one exception is Sample, the
 * developer example, which an install leaves off.
 *
 * `?theme=<preset>` (for example `ocean`) starts the workspace in that preset, so the site's
 * previews can match the page around them.
 */
export function demoWorkspace(search = ''): MockDb {
  const db = createMockDb('ready');
  const example = (id: string) => id === 'sample';
  db.manifests = db.manifests.filter((manifest) => !example(manifest.id));
  db.grants = db.grants.filter((grant) => !example(grant.moduleId));
  db.adminModules = db.adminModules.map((module) =>
    example(module.id)
      ? { ...module, enabled: false, enabledAt: null, versionInstalled: null }
      : module,
  );
  const preset = PRESETS.find((entry) => entry.id === new URLSearchParams(search).get('theme'));
  if (preset && preset.id !== 'light') {
    db.settings['appearance.theme'] = preset.id;
    db.settings['appearance.mode'] = preset.mode;
  }
  return db;
}
