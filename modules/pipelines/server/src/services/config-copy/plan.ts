import { appReferencesOf } from '../../../../shared/app-references.ts';
import type { CopyApplication, CopyItem, CopySecretMode } from '../../../../shared/config-copy.ts';
import {
  flattenDeploySettings,
  type DeploySettingField,
  type DeploySettings,
  nestDeploySettings,
  type FlatDeploySettings,
} from '../../../../shared/deploy-settings.ts';
import { appliesOn, fileLayersOf, resolveDeploySettings } from '../deploy-settings/resolve.ts';
import type { CopyApplicationState, CopyEnvironment } from './read.ts';

/*
 * The copy plan for one application: each item that differs between source and target.
 * Variables copy as written. A secret is copied store to store or left needing a value;
 * Prod's secrets are often different, so a prod-class target starts at needing a value.
 * Settings are those made in Pipelines on the source, shown as the value the target's next
 * deploy would use before and after. A setting the target's runtime lacks is dropped, and a
 * minimum lower than a prod-class target's default starts unticked, so Prod keeps its own.
 */

export const itemId = (application: string, kind: CopyItem['kind'], name: string) =>
  `${application}:${kind}:${name}`;

export const secretModeFor = (to: CopyEnvironment): CopySecretMode =>
  to.class === 'prod' ? 'needs-value' : 'copy';

function variableItems(app: CopyApplicationState, to: CopyEnvironment) {
  const items: CopyItem[] = [];
  let same = 0;
  for (const source of app.from.variables) {
    const target = app.to.variables.find((row) => row.name === source.name);
    if (source.kind === 'secret') {
      if (target) {
        same += 1;
        continue;
      }
      items.push({
        id: itemId(app.key, 'secret', source.name),
        kind: 'secret',
        name: source.name,
        location: source.secret_ref ? `${source.account ?? '?'} / ${source.secret_ref}` : '',
        mode: source.secret_ref ? secretModeFor(to) : 'needs-value',
        ticked: true,
      });
      continue;
    }
    const value = source.value ?? '';
    if (target?.kind === 'plain' && target.value === value) {
      same += 1;
      continue;
    }
    if (target?.kind === 'secret') continue;
    items.push({
      id: itemId(app.key, 'variable', source.name),
      kind: 'variable',
      name: source.name,
      before: target?.value ?? null,
      after: value,
      reference: appReferencesOf(value).length > 0,
      ticked: true,
    });
  }
  return { items, same };
}

/** The target's settings resolved with `pipelines` as its own layer. */
export function resolveTarget(
  app: CopyApplicationState,
  to: CopyEnvironment,
  pipelines: DeploySettings,
) {
  const { file, fileEnvironment, extras } = fileLayersOf(app.resolvedConfig, to.key);
  return resolveDeploySettings({
    layers: { pipelines, file, fileEnvironment },
    runtime: app.to.runtime,
    environmentClass: to.class,
    environmentKey: to.key,
    extras,
  });
}

/** The target's own layer with the copied values on top, before checking. */
export function withCopied(own: DeploySettings, copied: FlatDeploySettings) {
  return nestDeploySettings({ ...flattenDeploySettings(own), ...copied }) as DeploySettings;
}

function settingItems(app: CopyApplicationState, to: CopyEnvironment) {
  const items: CopyItem[] = [];
  let same = 0;
  const own = flattenDeploySettings(app.to.settings);
  const now = resolveTarget(app, to, app.to.settings);
  const valueOf = (entries: typeof now.entries, field: DeploySettingField) =>
    entries.find((entry) => entry.field === field);
  const source = flattenDeploySettings(app.from.settings);
  for (const [field, value] of Object.entries(source) as Array<
    [DeploySettingField, number | string]
  >) {
    if (own[field] === value) {
      same += 1;
      continue;
    }
    const id = itemId(app.key, 'setting', field);
    if (!appliesOn(field, app.to.runtime)) {
      items.push({
        id,
        kind: 'setting',
        field,
        before: null,
        after: value,
        applies: false,
        note: 'dropped',
        ticked: false,
      });
      continue;
    }
    const before = valueOf(now.entries, field);
    const after = valueOf(
      resolveTarget(app, to, withCopied(app.to.settings, { [field]: value })).entries,
      field,
    );
    if (before?.value === after?.value && own[field] === undefined) {
      same += 1;
      continue;
    }
    const lowersDefault =
      field === 'scaling.min' &&
      to.class === 'prod' &&
      before?.source === 'default' &&
      typeof before.value === 'number' &&
      typeof value === 'number' &&
      value < before.value;
    items.push({
      id,
      kind: 'setting',
      field,
      before: before?.value ?? null,
      after: after?.value ?? null,
      applies: true,
      note: lowersDefault ? 'keeps-default' : null,
      ticked: !lowersDefault,
    });
  }
  return { items, same };
}

export function planApplication(app: CopyApplicationState, to: CopyEnvironment): CopyApplication {
  const variables = variableItems(app, to);
  const settings = settingItems(app, to);
  return {
    application: { key: app.key, name: app.name },
    runtime: { from: app.from.runtime, to: app.to.runtime },
    items: [...variables.items, ...settings.items],
    same: variables.same + settings.same,
  };
}
