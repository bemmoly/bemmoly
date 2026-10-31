import {
  DEPLOY_SETTING_FIELDS,
  deploySettingsSchema,
  flattenDeploySettings,
  nestDeploySettings,
  type DeploySettingField,
  type DeploySettingSource,
  type DeploySettings,
} from '@bemmoly/module-pipelines/shared';

/*
 * The settings tab's rules, apart from its drawing: each setting's words, which ones are
 * numbers, and the edit form as text fields that turn back into the settings Pipelines holds.
 * A field left empty follows application.yaml, then the runtime's default.
 */

/** Message ids cannot carry the dots in a setting's name. */
export const FIELD_LABEL = {
  'scaling.min': 'pipelines.deploySettings.field.min',
  'scaling.max': 'pipelines.deploySettings.field.max',
  'scaling.concurrency': 'pipelines.deploySettings.field.concurrency',
  'scaling.cpuTarget': 'pipelines.deploySettings.field.cpuTarget',
  'resources.cpu': 'pipelines.deploySettings.field.cpu',
  'resources.memory': 'pipelines.deploySettings.field.memory',
  port: 'pipelines.deploySettings.field.port',
  'healthcheck.path': 'pipelines.deploySettings.field.healthPath',
  'healthcheck.ready': 'pipelines.deploySettings.field.readyPath',
  secretsAs: 'pipelines.deploySettings.field.secretsAs',
} as const satisfies Record<DeploySettingField, string>;

export const SOURCE_LABEL = {
  pipelines: 'pipelines.deploySettings.source.pipelines',
  'file-environment': 'pipelines.deploySettings.source.fileEnvironment',
  file: 'pipelines.deploySettings.source.file',
  default: 'pipelines.deploySettings.source.default',
} as const satisfies Record<DeploySettingSource, string>;

const NUMBERS: ReadonlySet<DeploySettingField> = new Set([
  'scaling.min',
  'scaling.max',
  'scaling.concurrency',
  'scaling.cpuTarget',
  'port',
]);

export const isNumberField = (field: DeploySettingField) => NUMBERS.has(field);

/** The form: one text per setting, empty for "follow the file". */
export type SettingsDraft = Record<DeploySettingField, string>;

export function draftOf(settings: DeploySettings): SettingsDraft {
  const flat = flattenDeploySettings(settings);
  return Object.fromEntries(
    DEPLOY_SETTING_FIELDS.map((field) => [
      field,
      flat[field] === undefined ? '' : String(flat[field]),
    ]),
  ) as SettingsDraft;
}

/** The settings the form says, or the first field that does not parse. */
export function bodyOf(
  draft: SettingsDraft,
): { ok: true; body: DeploySettings } | { ok: false; field: DeploySettingField } {
  const flat: Record<string, number | string> = {};
  for (const field of DEPLOY_SETTING_FIELDS) {
    const text = draft[field].trim();
    if (!text) continue;
    if (isNumberField(field)) {
      const value = Number(text);
      if (!Number.isInteger(value)) return { ok: false, field };
      flat[field] = value;
    } else flat[field] = text;
  }
  for (const field of DEPLOY_SETTING_FIELDS) {
    if (flat[field] === undefined) continue;
    const one = deploySettingsSchema.safeParse(nestDeploySettings({ [field]: flat[field] }));
    if (!one.success) return { ok: false, field };
  }
  const parsed = deploySettingsSchema.parse(nestDeploySettings(flat));
  return { ok: true, body: parsed };
}
