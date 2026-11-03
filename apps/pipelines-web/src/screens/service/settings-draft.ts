import {
  DEPLOY_SETTING_FIELDS,
  type ApplicationDeploySettings,
  type DeploySettingField,
} from '@bemmoly/module-pipelines/shared';
import { useState } from 'react';
import { bodyOf, draftOf, type SettingsDraft } from '../application/settings/fields.ts';

/** A setting the draft changes: what is saved here now, and what the draft says. */
export interface DraftChange {
  field: DeploySettingField;
  from: string;
  to: string;
}

export function changesOf(saved: SettingsDraft, draft: SettingsDraft): DraftChange[] {
  return DEPLOY_SETTING_FIELDS.filter((field) => saved[field].trim() !== draft[field].trim()).map(
    (field) => ({ field, from: saved[field].trim(), to: draft[field].trim() }),
  );
}

/** What the file or the runtime would use, shown in an empty field: "follow this". */
export function followedValue(item: ApplicationDeploySettings, field: DeploySettingField) {
  const entry = item.effective.find((each) => each.field === field);
  if (!entry?.applies || entry.source === 'pipelines' || entry.value === null) return '';
  return String(entry.value);
}

/**
 * One environment's settings form: the settings made in Pipelines as text, what changed from
 * them, and the body to save (or the first field that does not parse). Mounted per
 * environment, so switching environment starts from what is saved there.
 */
export function useSettingsDraft(item: ApplicationDeploySettings) {
  const saved = draftOf(item.settings);
  const [draft, setDraft] = useState<SettingsDraft>(saved);
  const changes = changesOf(saved, draft);
  return {
    draft,
    changes,
    parsed: bodyOf(draft),
    set: (field: DeploySettingField, value: string) =>
      setDraft((current) => ({ ...current, [field]: value })),
    /** Copy another environment's settings made here into the form. */
    copy: (from: ApplicationDeploySettings) => setDraft(draftOf(from.settings)),
    reset: () => setDraft(saved),
  };
}
