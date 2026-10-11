import type { SettingsSectionMode } from '@bemmoly/ui';
import type { SettingsAccess } from '../../hooks/settings-access.ts';
import type { BoardSettings } from '../../hooks/settings-board.ts';

/** What every Board settings tab gets from the page: the settings, its edit state and access. */
export interface BoardTabProps {
  settings: BoardSettings;
  mode: SettingsSectionMode;
  access: SettingsAccess;
  /** Problems that stop this tab's save, worked out by the page. */
  problems: readonly string[];
  saving: boolean;
  error: unknown;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}

/** The footer props a tab passes to EditFooter. */
export const footerProps = (props: BoardTabProps, dirty: boolean) => ({
  dirty,
  saving: props.saving,
  problems: props.problems,
  error: props.error,
  onCancel: props.onCancel,
  onSave: props.onSave,
});
